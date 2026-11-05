import type { AdminReport, ReportReason, Review } from '@aterriza/contracts'
import type { Db } from '../../platform/db.ts'
import { type Actor, type AuditLog, DomainError, type EventPublisher, notFound } from '../../platform/kernel.ts'
import type { BookingService } from '../bookings/service.ts'
import { type FlagPolicy, stayLabel } from './domain.ts'

export class TrustService {
  constructor(
    private readonly db: Db,
    private readonly bookings: Pick<BookingService, 'reviewableBooking'>,
    private readonly flagPolicy: FlagPolicy,
    private readonly audit: AuditLog,
    private readonly events: EventPublisher,
  ) {}

  async forListing(listingId: string): Promise<Review[]> {
    const rows = await this.db.query<{ id: string; rating: number; comment: string; stay_label: string; full_name: string; deleted_at: Date | null; created_at: Date }>(
      `SELECT r.id, r.rating, r.comment, r.stay_label, u.full_name, u.deleted_at, r.created_at
       FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.listing_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [listingId],
    )
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      stayLabel: r.stay_label,
      authorName: r.deleted_at ? 'Estudiante' : shortName(r.full_name),
      createdAt: r.created_at.toISOString(),
    }))
  }

  async hasReported(listingId: string, userId: string): Promise<boolean> {
    return (await this.db.query('SELECT 1 FROM reports WHERE listing_id = $1 AND reporter_id = $2', [listingId, userId])).length > 0
  }

  async submitReview(actor: Actor, listingId: string, input: { rating: number; comment: string }): Promise<{ id: string }> {
    const booking = await this.bookings.reviewableBooking(listingId, actor.id)
    if (!booking) {
      throw new DomainError('forbidden', 'no_verified_stay', 'Solo quien vivió aquí con una estancia comprobada puede dejar reseña.')
    }
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO reviews (listing_id, booking_id, author_id, rating, comment, stay_label) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [listingId, booking.id, actor.id, input.rating, input.comment, stayLabel(booking.start_date, booking.end_date)],
    )
    await this.audit.record({ actorId: actor.id, action: 'review.created', entity: 'review', entityId: row!.id })
    return { id: row!.id }
  }

  async report(actor: Actor, listingId: string, input: { reason: ReportReason; detail?: string }): Promise<{ flagged: boolean }> {
    const [listing] = await this.db.query<{ landlord_id: string; status: string; title: string }>('SELECT landlord_id, status, title FROM listings WHERE id = $1', [listingId])
    if (!listing || listing.status !== 'active') throw notFound('La vivienda')
    if (listing.landlord_id === actor.id) throw new DomainError('forbidden', 'own_listing', 'No puedes reportar tu propia vivienda.')

    const flagged = await this.db.tx(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO reports (listing_id, reporter_id, reason, detail) VALUES ($1,$2,$3,$4)
         ON CONFLICT (listing_id, reporter_id) DO NOTHING RETURNING id`,
        [listingId, actor.id, input.reason, input.detail ?? null],
      )
      if (inserted.length === 0) throw new DomainError('conflict', 'already_reported', 'Ya reportaste esta vivienda. La estamos revisando.')
      const [c] = await tx.query<{ n: number }>(`SELECT count(DISTINCT reporter_id)::int AS n FROM reports WHERE listing_id = $1 AND status = 'open'`, [listingId])
      const flag = this.flagPolicy.shouldFlag(c?.n ?? 0)
      if (flag) await tx.query(`UPDATE listings SET status = 'under_review', updated_at = now() WHERE id = $1`, [listingId])
      await this.audit.record({ actorId: actor.id, action: 'listing.reported', entity: 'listing', entityId: listingId, meta: { reason: input.reason, flagged: flag } }, tx)
      return flag
    })
    if (flagged) await this.events.publish({ type: 'listing.flagged', listingId, title: listing.title, landlordId: listing.landlord_id })
    return { flagged }
  }

  async openReports(): Promise<AdminReport[]> {
    const rows = await this.db.query<{ id: string; listing_id: string; title: string; status: AdminReport['listingStatus']; reason: ReportReason; detail: string | null; full_name: string; created_at: Date }>(
      `SELECT r.id, r.listing_id, l.title, l.status, r.reason, r.detail, u.full_name, r.created_at
       FROM reports r JOIN listings l ON l.id = r.listing_id JOIN users u ON u.id = r.reporter_id
       WHERE r.status = 'open' ORDER BY r.created_at`,
    )
    return rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.title,
      listingStatus: r.status,
      reason: r.reason,
      detail: r.detail,
      reporterName: r.full_name,
      createdAt: r.created_at.toISOString(),
    }))
  }

  /**
   * Confirmar archiva la vivienda y cierra todos sus reportes. Desestimar cierra el reporte;
   * si no quedan reportes abiertos, la vivienda vuelve a estar pública.
   */
  async resolve(admin: Actor, reportId: string, decision: 'dismiss' | 'uphold'): Promise<void> {
    await this.db.tx(async (tx) => {
      const [report] = await tx.query<{ listing_id: string }>(`SELECT listing_id FROM reports WHERE id = $1 AND status = 'open' FOR UPDATE`, [reportId])
      if (!report) throw notFound('El reporte')
      if (decision === 'uphold') {
        await tx.query(`UPDATE reports SET status = 'upheld', resolved_by = $2, resolved_at = now() WHERE listing_id = $1 AND status = 'open'`, [report.listing_id, admin.id])
        await tx.query(`UPDATE listings SET status = 'archived', updated_at = now() WHERE id = $1`, [report.listing_id])
      } else {
        await tx.query(`UPDATE reports SET status = 'dismissed', resolved_by = $2, resolved_at = now() WHERE id = $1`, [reportId, admin.id])
        const [left] = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM reports WHERE listing_id = $1 AND status = 'open'`, [report.listing_id])
        if (left?.n === 0) {
          await tx.query(`UPDATE listings SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'under_review'`, [report.listing_id])
        }
      }
      await this.audit.record({ actorId: admin.id, action: `report.${decision}`, entity: 'report', entityId: reportId }, tx)
    })
  }
}

/** Para reseñas públicas: "Tomás R." en vez del nombre completo. */
export function shortName(full: string): string {
  const [first, second] = full.trim().split(/\s+/)
  return second ? `${first} ${second[0]}.` : (first ?? '')
}
