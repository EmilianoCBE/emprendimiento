import { CRITERIA, type AdminQueueItem, type Criterion, type ListingCard, type ListingDetail, type ListingInput, type ListingQuery, type MentorCard, type OwnedListing, type Paged, type PriceAlert, type Review, type Zone } from '@aterriza/contracts'
import type { Db } from '../../platform/db.ts'
import { type Actor, type AuditLog, DomainError, type EventPublisher, type FileStore, notFound } from '../../platform/kernel.ts'
import { detectImageType } from '../../platform/files.ts'
import type { ListingCostFacts, PlanningService } from '../planning/service.ts'
import { trustScore } from '../trust/domain.ts'
import { PARTIAL_THRESHOLD, type PriceAlertPolicy, approximateNear, benchmarkFor, criteriaFromRows, median, priceCategory, verificationLevel } from './domain.ts'
import type { ListingRepository, ListingRow } from './repository.ts'

/** Lo que la ficha necesita de otros módulos, como interfaces pequeñas (ISP). */
export interface ReviewReader {
  forListing(listingId: string): Promise<Review[]>
  hasReported(listingId: string, userId: string): Promise<boolean>
}
export interface MentorReader {
  forZone(zoneSlug: string, limit: number): Promise<MentorCard[]>
}
export interface BookingReader {
  viewerState(listingId: string, actorId: string): Promise<{ activeBookingId: string | null; addressVisible: boolean; canReview: boolean; hasActiveBooking: boolean }>
  blockersFor(listing: { status: string; metCount: number; occupied: boolean; isOwner: boolean; minMonths: number }, actor: Actor, hasActive: boolean): string[]
}

const MAX_PHOTOS = 10
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export { MAX_PHOTO_BYTES }

export class ListingService {
  constructor(
    private readonly db: Db,
    private readonly repo: ListingRepository,
    private readonly priceAlerts: PriceAlertPolicy,
    private readonly planning: PlanningService,
    private readonly files: FileStore,
    private readonly audit: AuditLog,
    private readonly events: EventPublisher,
    private readonly readers: { reviews: ReviewReader; mentors: MentorReader; bookings: BookingReader },
  ) {}

  // ---------- Lectura pública ----------
  private async alertFactory(): Promise<(r: Pick<ListingRow, 'zone_id' | 'kind' | 'monthly_rent_mxn'>) => PriceAlert | null> {
    const all = await this.repo.activeRents()
    return ({ zone_id, kind, monthly_rent_mxn }) => {
      const peers = all.filter((x) => priceCategory(x.kind) === priceCategory(kind))
      const city = peers.map((x) => x.monthly_rent_mxn)
      const zone = peers.filter((x) => x.zone_id === zone_id).map((x) => x.monthly_rent_mxn)
      return this.priceAlerts.evaluate(monthly_rent_mxn, benchmarkFor(zone, city))
    }
  }

  private toFacts(r: ListingRow): ListingCostFacts {
    return {
      monthlyRentMxn: r.monthly_rent_mxn,
      depositMonths: r.deposit_months,
      utilitiesIncluded: r.utilities_included,
      minutesTransit: r.minutes_transit,
      airConditioning: r.air_conditioning,
    }
  }

  private toCard(r: ListingRow, alert: PriceAlert | null, estimatedMonthlyMxn: number): ListingCard {
    return {
      id: r.id,
      title: r.title,
      kind: r.kind,
      zoneName: r.zone_name,
      zoneSlug: r.zone_slug,
      monthlyRentMxn: r.monthly_rent_mxn,
      estimatedMonthlyMxn,
      depositMonths: r.deposit_months,
      minutesWalk: r.minutes_walk,
      minutesTransit: r.minutes_transit,
      furnished: r.furnished,
      utilitiesIncluded: r.utilities_included,
      semesterContract: r.semester_contract,
      approxLat: r.approx_lat,
      approxLng: r.approx_lng,
      photo: r.photo_url ? { url: r.photo_url, alt: r.photo_alt ?? r.title } : null,
      metCount: r.met_count,
      level: verificationLevel(r.met_count),
      priceAlert: alert,
      rating: trustScore(r.ratings ?? []),
      reviewCount: r.ratings?.length ?? 0,
    }
  }

  async search(query: ListingQuery): Promise<Paged<ListingCard>> {
    const [{ rows, total }, alertFor, assumptions] = await Promise.all([
      this.repo.search(query),
      this.alertFactory(),
      this.planning.loadAssumptions(),
    ])
    const items = rows.map((r) =>
      this.toCard(r, alertFor(r), this.planning.estimateWith(this.toFacts(r), assumptions).typicalMonthTotalMxn),
    )
    return { items, total, page: query.page, pageSize: query.pageSize }
  }

  async zones(): Promise<Zone[]> {
    const [zones, rents] = await Promise.all([this.repo.zones(), this.repo.activeRents()])
    return zones.map((z) => {
      const inZone = rents.filter((r) => r.zone_id === z.id).map((r) => r.monthly_rent_mxn)
      return { ...z, listingCount: inZone.length, medianRentMxn: inZone.length > 0 ? median(inZone) : null }
    })
  }

  /** Facade: una ficha reúne datos de cuatro módulos en una sola llamada. */
  async detail(id: string, actor: Actor | null): Promise<ListingDetail> {
    const row = await this.repo.get(id)
    if (!row) throw notFound('La vivienda')
    const isOwner = actor?.id === row.landlord_id
    const isAdmin = actor?.role === 'admin'
    if (row.status !== 'active' && !isOwner && !isAdmin) throw notFound('La vivienda')

    const [photos, costItems, criteriaRows, reviews, mentors, budget, alertFor, state, hasReported] = await Promise.all([
      this.repo.photos(id),
      this.repo.costItems(id),
      this.repo.criteria(id),
      this.readers.reviews.forListing(id),
      this.readers.mentors.forZone(row.zone_slug, 3),
      this.planning.estimateForListing(this.toFacts(row)),
      this.alertFactory(),
      actor ? this.readers.bookings.viewerState(id, actor.id) : Promise.resolve(null),
      actor ? this.readers.reviews.hasReported(id, actor.id) : Promise.resolve(false),
    ])
    const seal = criteriaFromRows(criteriaRows)
    const canSeeAddress = isOwner || isAdmin || state?.addressVisible === true
    const { photo: _photo, ...card } = this.toCard(row, alertFor(row), budget.typicalMonthTotalMxn)

    return {
      ...card,
      description: row.description,
      status: row.status,
      minMonths: row.min_months,
      airConditioning: row.air_conditioning,
      availableFrom: row.available_from,
      occupied: row.occupied,
      photos,
      costItems: costItems.map((i) => ({ label: i.label, included: i.included, estimateMxn: i.estimate_mxn })),
      verification: { level: seal.level, metCount: seal.metCount, criteria: seal.criteria },
      reviews,
      mentors,
      budget,
      landlordName: row.landlord_name,
      landlordId: row.landlord_id,
      exactAddress: canSeeAddress ? await this.repo.getExactAddress(id) : null,
      viewer: {
        isOwner,
        activeBookingId: state?.activeBookingId ?? null,
        canReview: state?.canReview ?? false,
        hasReported,
        blockers: actor
          ? this.readers.bookings.blockersFor(
              { status: row.status, metCount: seal.metCount, occupied: row.occupied, isOwner, minMonths: row.min_months },
              actor,
              state?.hasActiveBooking ?? false,
            )
          : [],
      },
    }
  }

  // ---------- Arrendador ----------
  private async owned(actor: Actor, id: string): Promise<ListingRow> {
    const row = await this.repo.get(id)
    if (!row || row.landlord_id !== actor.id) throw notFound('La vivienda')
    return row
  }

  async mine(actor: Actor): Promise<OwnedListing[]> {
    const rows = await this.repo.listByLandlord(actor.id)
    const ids = rows.map((r) => r.id)
    const [photos, criteria, pending] = await Promise.all([this.repo.photosFor(ids), this.repo.criteriaFor(ids), this.repo.pendingBookingCounts(actor.id)])
    const out: OwnedListing[] = []
    for (const r of rows) {
      const input = await this.repo.inputOf(r.id)
      const own = photos.filter((p) => p.listing_id === r.id)
      const seal = criteriaFromRows(criteria.filter((c) => c.listing_id === r.id))
      const { landlordId: _l, ...cleanInput } = input!
      out.push({
        id: r.id,
        title: r.title,
        status: r.status,
        monthlyRentMxn: r.monthly_rent_mxn,
        zoneName: r.zone_name,
        metCount: seal.metCount,
        level: seal.level,
        reviewNote: r.review_note,
        photoCount: own.length,
        pendingBookings: pending.get(r.id) ?? 0,
        photo: r.photo_url ? { url: r.photo_url, alt: r.photo_alt ?? r.title } : null,
        input: cleanInput,
        photos: own.map((p) => ({ id: p.id, url: p.url, alt: p.alt })),
        criteria: seal.criteria,
      })
    }
    return out
  }

  async create(actor: Actor, input: ListingInput): Promise<{ id: string }> {
    const zone = await this.repo.zoneCoords(input.zoneId)
    if (!zone) throw new DomainError('bad_request', 'invalid_zone', 'Elige una zona válida.')
    const coords = approximateNear(zone.lat, zone.lng, `${actor.id}${input.title}`)
    const id = await this.db.tx(async (tx) => {
      const newId = await this.repo.insert(actor.id, input, coords, tx)
      await this.audit.record({ actorId: actor.id, action: 'listing.created', entity: 'listing', entityId: newId }, tx)
      return newId
    })
    return { id }
  }

  async update(actor: Actor, id: string, input: ListingInput): Promise<void> {
    const row = await this.owned(actor, id)
    if (row.status === 'archived' || row.status === 'under_review') {
      throw new DomainError('conflict', 'not_editable', 'Esta vivienda no se puede editar en su estado actual.')
    }
    const zone = await this.repo.zoneCoords(input.zoneId)
    if (!zone) throw new DomainError('bad_request', 'invalid_zone', 'Elige una zona válida.')
    const previous = await this.repo.inputOf(id)
    // Un anuncio aprobado no puede transformarse en otro: todo cambio, salvo la fecha de disponibilidad, se vuelve a revisar.
    const reviewable = ({ availableFrom: _a, costItems, ...rest }: ListingInput) =>
      JSON.stringify({ ...rest, costItems: costItems.map((c) => ({ label: c.label, included: c.included, estimateMxn: c.estimateMxn ?? null })) })
    const { landlordId: _l, ...before } = previous!
    const keyChanged = reviewable(before) !== reviewable(input)
    const status = row.status === 'active' && keyChanged ? 'pending_review' : row.status
    const coords =
      previous!.zoneId === input.zoneId ? { lat: row.approx_lat, lng: row.approx_lng } : approximateNear(zone.lat, zone.lng, `${actor.id}${input.title}`)
    await this.db.tx(async (tx) => {
      await this.repo.update(id, input, coords, status, tx)
      await this.audit.record({ actorId: actor.id, action: 'listing.updated', entity: 'listing', entityId: id, meta: { sentToReview: status !== row.status } }, tx)
    })
  }

  async submit(actor: Actor, id: string): Promise<void> {
    const row = await this.owned(actor, id)
    if (row.status !== 'draft') throw new DomainError('conflict', 'not_draft', 'Solo se envían a revisión los borradores.')
    if (!row.photo_url) throw new DomainError('unprocessable', 'photos_required', 'Agrega al menos una foto antes de enviar.')
    await this.repo.setStatus(id, 'pending_review', null)
    await this.audit.record({ actorId: actor.id, action: 'listing.submitted', entity: 'listing', entityId: id })
  }

  async archive(actor: Actor, id: string): Promise<void> {
    await this.owned(actor, id)
    await this.repo.setStatus(id, 'archived', null)
    await this.audit.record({ actorId: actor.id, action: 'listing.archived', entity: 'listing', entityId: id })
  }

  async addPhoto(actor: Actor, id: string, bytes: Buffer, alt: string) {
    const row = await this.owned(actor, id)
    if (bytes.length > MAX_PHOTO_BYTES) throw new DomainError('bad_request', 'photo_too_large', 'La foto no puede pesar más de 5 MB.')
    const ext = detectImageType(bytes)
    if (!ext) throw new DomainError('bad_request', 'invalid_photo', 'La foto debe ser JPG, PNG o WebP.')
    const existing = await this.repo.photos(id)
    if (existing.length >= MAX_PHOTOS) throw new DomainError('conflict', 'too_many_photos', `Puedes subir hasta ${MAX_PHOTOS} fotos.`)
    const url = await this.files.save(bytes, ext)
    const photo = await this.repo.addPhoto(id, url, alt.trim().slice(0, 140) || row.title)
    if (row.status === 'active') await this.repo.setStatus(id, 'pending_review', null)
    await this.audit.record({ actorId: actor.id, action: 'listing.photo_added', entity: 'listing', entityId: id })
    return photo
  }

  async deletePhoto(actor: Actor, id: string, photoId: string): Promise<void> {
    const row = await this.owned(actor, id)
    const url = await this.repo.deletePhoto(id, photoId)
    if (!url) throw notFound('La foto')
    if (row.status === 'active') await this.repo.setStatus(id, 'pending_review', null)
    await this.files.remove(url)
  }

  // ---------- Administración ----------
  async reviewQueue(): Promise<AdminQueueItem[]> {
    const [rows, alertFor] = await Promise.all([this.repo.listForReview(), this.alertFactory()])
    const criteria = await this.repo.criteriaFor(rows.map((r) => r.id))
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      zoneName: r.zone_name,
      landlordName: r.landlord_name,
      monthlyRentMxn: r.monthly_rent_mxn,
      reviewNote: r.review_note,
      reportCount: r.report_count,
      photo: r.photo_url ? { url: r.photo_url, alt: r.photo_alt ?? r.title } : null,
      priceAlert: alertFor(r),
      criteria: criteriaFromRows(criteria.filter((c) => c.listing_id === r.id)).criteria,
    }))
  }

  async setCriteria(admin: Actor, id: string, criteria: Record<Criterion, boolean>): Promise<void> {
    const row = await this.repo.get(id)
    if (!row) throw notFound('La vivienda')
    await this.db.tx(async (tx) => {
      for (const c of CRITERIA) await this.repo.setCriterion(id, c, criteria[c], admin.id, tx)
      await this.audit.record({ actorId: admin.id, action: 'listing.criteria_set', entity: 'listing', entityId: id, meta: { criteria } }, tx)
    })
  }

  async decide(admin: Actor, id: string, decision: 'approve' | 'return' | 'archive', note?: string): Promise<void> {
    const row = await this.repo.get(id)
    if (!row) throw notFound('La vivienda')
    if (row.status !== 'pending_review' && row.status !== 'under_review') {
      throw new DomainError('conflict', 'not_in_review', 'Esta vivienda no está en revisión.')
    }
    if (decision === 'approve' && row.met_count < PARTIAL_THRESHOLD) {
      throw new DomainError('unprocessable', 'not_enough_criteria', `Marca al menos ${PARTIAL_THRESHOLD} criterios antes de aprobar.`)
    }
    const nextStatus = decision === 'approve' ? 'active' : decision === 'return' ? 'draft' : 'archived'
    await this.db.tx(async (tx) => {
      await this.repo.setStatus(id, nextStatus, note ?? null, tx)
      await this.audit.record({ actorId: admin.id, action: `listing.${decision}`, entity: 'listing', entityId: id }, tx)
    })
    await this.events.publish({ type: 'listing.decided', listingId: id, landlordId: row.landlord_id, decision, title: row.title, note })
  }
}
