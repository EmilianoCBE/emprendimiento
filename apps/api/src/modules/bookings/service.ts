import { BOOKING_STEPS, type Booking, type BookingAction, type BookingStatus, type BookingStep } from '@aterriza/contracts'
import type { Db, Queryable } from '../../platform/db.ts'
import { type Actor, type AuditLog, DomainError, type EventPublisher, notFound } from '../../platform/kernel.ts'
import { verificationLevel } from '../listings/domain.ts'
import { ACTIVE_STATUSES, ADDRESS_VISIBLE, type BookingParty, allowedActions, evaluateBooking, nextStatus } from './domain.ts'

interface BookingRow {
  id: string
  status: BookingStatus
  start_date: string
  end_date: string
  message: string
  tour_at: Date | null
  created_at: Date
  listing_id: string
  listing_title: string
  zone_name: string
  monthly_rent_mxn: number
  exact_address: string
  photo_url: string | null
  photo_alt: string | null
  student_id: string
  student_name: string
  landlord_id: string
  landlord_name: string
  conversation_id: string | null
  has_review: boolean
}

const SELECT = `
  SELECT b.id, b.status, b.start_date::text AS start_date, b.end_date::text AS end_date, b.message, b.tour_at, b.created_at,
    l.id AS listing_id, l.title AS listing_title, z.name AS zone_name, l.monthly_rent_mxn, l.exact_address,
    (SELECT p.url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo_url,
    (SELECT p.alt FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo_alt,
    b.student_id, s.full_name AS student_name, l.landlord_id, o.full_name AS landlord_name,
    (SELECT c.id FROM conversations c WHERE c.booking_id = b.id LIMIT 1) AS conversation_id,
    EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review
  FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN zones z ON z.id = l.zone_id
  JOIN users s ON s.id = b.student_id JOIN users o ON o.id = l.landlord_id`

/** Una estancia se puede reseñar si concluyó o si ya empezó y está confirmada. */
export function stayIsReviewable(status: BookingStatus, startDate: string, today: string): boolean {
  return status === 'completed' || (status === 'confirmed' && startDate <= today)
}

const today = () => new Date().toISOString().slice(0, 10)

export class BookingService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditLog,
    private readonly events: EventPublisher,
  ) {}

  private partyOf(actor: Actor, row: { student_id: string; landlord_id: string }): BookingParty | null {
    if (row.student_id === actor.id) return 'student'
    if (row.landlord_id === actor.id) return 'landlord'
    if (actor.role === 'admin') return 'admin'
    return null
  }

  async request(actor: Actor, input: { listingId: string; startDate: string; endDate: string; message: string; fraudNoticeAck: boolean }): Promise<{ id: string }> {
    const [listing] = await this.db.query<{ landlord_id: string; title: string; status: string; min_months: number; met: number; occupied: boolean }>(
      `SELECT l.landlord_id, l.title, l.status, l.min_months,
         (SELECT count(*)::int FROM listing_criteria c WHERE c.listing_id = l.id AND c.met) AS met,
         (l.occupied_until IS NOT NULL AND l.occupied_until >= current_date) AS occupied
       FROM listings l WHERE l.id = $1`,
      [input.listingId],
    )
    if (!listing || listing.status === 'draft') throw notFound('La vivienda')
    const hasActive = await this.hasActiveBooking(input.listingId, actor.id)
    const problems = evaluateBooking({
      listingStatus: listing.status,
      level: verificationLevel(listing.met),
      occupied: listing.occupied,
      isOwner: listing.landlord_id === actor.id,
      actorRole: actor.role,
      studentValidated: actor.studentStatus === 'verified',
      hasActiveBooking: hasActive,
      minMonths: listing.min_months,
      startDate: input.startDate,
      endDate: input.endDate,
      today: today(),
      fraudNoticeAck: input.fraudNoticeAck,
    })
    if (problems.length > 0) throw new DomainError('unprocessable', 'booking_not_allowed', 'Todavía no puedes solicitar esta vivienda.', problems)

    const id = await this.db
      .tx(async (tx) => {
        const [b] = await tx.query<{ id: string }>(
          `INSERT INTO bookings (listing_id, student_id, status, start_date, end_date, message, fraud_notice_ack_at)
           VALUES ($1,$2,'requested',$3,$4,$5,now()) RETURNING id`,
          [input.listingId, actor.id, input.startDate, input.endDate, input.message],
        )
        await this.logEvent(tx, b!.id, actor.id, null, 'requested', null)
        // Abre el chat con el arrendador: la plática ocurre donde se puede advertir de un fraude.
        const [c] = await tx.query<{ id: string }>(
          `INSERT INTO conversations (kind, student_id, counterpart_id, booking_id, status, last_message_at)
           VALUES ('booking',$1,$2,$3,'active',now()) RETURNING id`,
          [actor.id, listing.landlord_id, b!.id],
        )
        await tx.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3)', [c!.id, actor.id, input.message])
        await this.audit.record({ actorId: actor.id, action: 'booking.requested', entity: 'booking', entityId: b!.id }, tx)
        return b!.id
      })
      .catch((err: { code?: string }) => {
        if (err.code === '23505') throw new DomainError('conflict', 'duplicate_booking', 'Ya tienes una solicitud activa para esta vivienda.')
        throw err
      })
    await this.events.publish({ type: 'booking.requested', bookingId: id, landlordId: listing.landlord_id, studentName: actor.fullName, listingTitle: listing.title })
    return { id }
  }

  private async logEvent(q: Queryable, bookingId: string, actorId: string, from: BookingStatus | null, to: BookingStatus, note: string | null): Promise<void> {
    await q.query('INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5)', [bookingId, actorId, from, to, note])
  }

  async list(actor: Actor): Promise<Booking[]> {
    const rows = await this.db.query<BookingRow>(`${SELECT} WHERE b.student_id = $1 OR l.landlord_id = $1 ORDER BY b.created_at DESC`, [actor.id])
    return rows.map((r) => this.toBooking(r, actor, []))
  }

  async get(actor: Actor, id: string): Promise<Booking> {
    const row = await this.getRow(id, this.db)
    if (!row || !this.partyOf(actor, row)) throw notFound('La solicitud')
    const events = await this.db.query<{ id: string; from_status: BookingStatus | null; to_status: BookingStatus; note: string | null; created_at: Date; actor_name: string }>(
      `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.full_name AS actor_name
       FROM booking_events e JOIN users u ON u.id = e.actor_id WHERE e.booking_id = $1 ORDER BY e.created_at`,
      [id],
    )
    const steps = await this.db.query<{ step: string }>('SELECT step FROM booking_steps WHERE booking_id = $1', [id])
    return this.toBooking(
      row,
      actor,
      events.map((e) => ({ id: e.id, fromStatus: e.from_status, toStatus: e.to_status, note: e.note, createdAt: e.created_at.toISOString(), actorName: e.actor_name })),
      steps.map((s) => s.step),
    )
  }

  private getRow(id: string, q: Queryable): Promise<BookingRow | undefined> {
    return q.query<BookingRow>(`${SELECT} WHERE b.id = $1`, [id]).then((r) => r[0])
  }

  async transition(actor: Actor, id: string, input: { action: BookingAction; tourAt?: string; note?: string }): Promise<Booking> {
    const result = await this.db.tx(async (tx) => {
      // Bloquea la fila: dos transiciones simultáneas no pueden pisarse.
      await tx.query('SELECT 1 FROM bookings WHERE id = $1 FOR UPDATE', [id])
      const row = await this.getRow(id, tx)
      if (!row) throw notFound('La solicitud')
      const party = this.partyOf(actor, row)
      if (!party) throw notFound('La solicitud')
      const to = nextStatus(row.status, input.action, party)
      if (!to) throw new DomainError('conflict', 'invalid_transition', 'Esta acción ya no está disponible para esta solicitud.')

      let tourAt: string | null = null
      if (input.action === 'schedule_tour') {
        if (!input.tourAt || Date.parse(input.tourAt) <= Date.now()) {
          throw new DomainError('bad_request', 'invalid_tour_date', 'Elige una fecha futura para la videollamada.')
        }
        tourAt = input.tourAt
      }
      await tx.query('UPDATE bookings SET status = $2, tour_at = COALESCE($3, tour_at), updated_at = now() WHERE id = $1', [id, to, tourAt])
      await this.logEvent(tx, id, actor.id, row.status, to, input.note ?? null)
      if (to === 'confirmed') await tx.query('UPDATE listings SET occupied_until = $2 WHERE id = $1', [row.listing_id, row.end_date])
      if (to === 'completed') await tx.query('UPDATE listings SET occupied_until = NULL WHERE id = $1', [row.listing_id])
      if (to === 'rejected' || to === 'cancelled') await tx.query(`UPDATE conversations SET status = 'closed' WHERE booking_id = $1`, [id])
      await this.audit.record({ actorId: actor.id, action: `booking.${input.action}`, entity: 'booking', entityId: id }, tx)
      return { row, to, tourAt }
    })
    const recipients = [result.row.student_id, result.row.landlord_id].filter((u) => u !== actor.id)
    for (const recipientId of recipients) {
      await this.events.publish({
        type: 'booking.changed',
        bookingId: id,
        recipientId,
        status: result.to,
        listingTitle: result.row.listing_title,
        tourAt: result.tourAt,
      })
    }
    return this.get(actor, id)
  }

  /** Avance de la lista para mudarte. Solo el estudiante de la solicitud la marca. */
  async setStep(actor: Actor, id: string, step: string, done: boolean): Promise<void> {
    const row = await this.getRow(id, this.db)
    if (!row || row.student_id !== actor.id) throw notFound('La solicitud')
    if (!BOOKING_STEPS.includes(step as BookingStep)) throw notFound('El paso')
    if (!ACTIVE_STATUSES.includes(row.status)) throw new DomainError('conflict', 'booking_closed', 'Esta solicitud ya está cerrada.')
    if (done) await this.db.query('INSERT INTO booking_steps (booking_id, step) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, step])
    else await this.db.query('DELETE FROM booking_steps WHERE booking_id = $1 AND step = $2', [id, step])
  }

  private toBooking(r: BookingRow, actor: Actor, events: Booking['events'], doneSteps: readonly string[] = []): Booking {
    const party = this.partyOf(actor, r) ?? 'admin'
    const addressVisible = party !== 'student' || ADDRESS_VISIBLE.includes(r.status)
    return {
      id: r.id,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      message: r.message,
      tourAt: r.tour_at ? r.tour_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
      listing: {
        id: r.listing_id,
        title: r.listing_title,
        zoneName: r.zone_name,
        monthlyRentMxn: r.monthly_rent_mxn,
        photo: r.photo_url ? { url: r.photo_url, alt: r.photo_alt ?? r.listing_title } : null,
      },
      studentName: r.student_name,
      landlordName: r.landlord_name,
      exactAddress: addressVisible ? r.exact_address : null,
      conversationId: r.conversation_id,
      reference: r.id.slice(0, 8).toUpperCase(),
      steps: BOOKING_STEPS.map((s) => ({ id: s, done: doneSteps.includes(s) })),
      allowedActions: allowedActions(r.status, party),
      canReview: party === 'student' && !r.has_review && stayIsReviewable(r.status, r.start_date, today()),
      events,
    }
  }

  private async hasActiveBooking(listingId: string, studentId: string): Promise<boolean> {
    const rows = await this.db.query('SELECT 1 FROM bookings WHERE listing_id = $1 AND student_id = $2 AND status = ANY($3) LIMIT 1', [listingId, studentId, [...ACTIVE_STATUSES]])
    return rows.length > 0
  }

  // ---------- Lectura para la ficha (BookingReader) ----------
  async viewerState(listingId: string, actorId: string) {
    const rows = await this.db.query<{ id: string; status: BookingStatus; start_date: string; has_review: boolean }>(
      `SELECT b.id, b.status, b.start_date::text AS start_date, EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review
       FROM bookings b WHERE b.listing_id = $1 AND b.student_id = $2 ORDER BY b.created_at DESC`,
      [listingId, actorId],
    )
    const active = rows.find((r) => ACTIVE_STATUSES.includes(r.status))
    return {
      activeBookingId: active?.id ?? null,
      hasActiveBooking: active !== undefined,
      addressVisible: rows.some((r) => ADDRESS_VISIBLE.includes(r.status)),
      canReview: rows.some((r) => !r.has_review && stayIsReviewable(r.status, r.start_date, today())),
    }
  }

  blockersFor(l: { status: string; metCount: number; occupied: boolean; isOwner: boolean; minMonths: number }, actor: Actor, hasActive: boolean): string[] {
    const start = today()
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2).toISOString().slice(0, 10)
    return evaluateBooking({
      listingStatus: l.status,
      level: verificationLevel(l.metCount),
      occupied: l.occupied,
      isOwner: l.isOwner,
      actorRole: actor.role,
      studentValidated: actor.studentStatus === 'verified',
      hasActiveBooking: hasActive,
      minMonths: l.minMonths,
      startDate: start,
      endDate: end,
      today: start,
      fraudNoticeAck: true,
    })
  }

  // ---------- Para reseñas ----------
  async reviewableBooking(listingId: string, studentId: string): Promise<{ id: string; start_date: string; end_date: string } | null> {
    const rows = await this.db.query<{ id: string; status: BookingStatus; start_date: string; end_date: string }>(
      `SELECT b.id, b.status, b.start_date::text AS start_date, b.end_date::text AS end_date FROM bookings b
       WHERE b.listing_id = $1 AND b.student_id = $2 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
       ORDER BY b.created_at DESC`,
      [listingId, studentId],
    )
    return rows.find((r) => stayIsReviewable(r.status, r.start_date, today())) ?? null
  }
}
