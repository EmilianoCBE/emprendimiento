import type { ListingInput, ListingQuery, ListingSort, Zone } from '@aterriza/contracts'
import type { Queryable } from '../../platform/db.ts'
import { SqlWhereBuilder, escapeLike } from './domain.ts'

export interface ListingRow {
  id: string
  landlord_id: string
  landlord_name: string
  zone_id: string
  zone_name: string
  zone_slug: string
  title: string
  description: string
  kind: ListingInput['kind']
  monthly_rent_mxn: number
  deposit_months: number
  min_months: number
  semester_contract: boolean
  minutes_walk: number
  minutes_transit: number
  furnished: boolean
  utilities_included: boolean
  air_conditioning: boolean
  approx_lat: number
  approx_lng: number
  available_from: string
  occupied: boolean
  status: 'draft' | 'pending_review' | 'active' | 'under_review' | 'archived'
  review_note: string | null
  met_count: number
  photo_url: string | null
  photo_alt: string | null
  ratings: number[] | null
}

/** La dirección exacta no está aquí a propósito: se pide con `getExactAddress`. */
const SELECT_LISTING = `
  SELECT l.id, l.landlord_id, u.full_name AS landlord_name, l.zone_id, z.name AS zone_name, z.slug AS zone_slug,
    l.title, l.description, l.kind, l.monthly_rent_mxn, l.deposit_months, l.min_months, l.semester_contract,
    l.minutes_walk, l.minutes_transit, l.furnished, l.utilities_included, l.air_conditioning,
    l.approx_lat, l.approx_lng, l.available_from::text AS available_from,
    (l.occupied_until IS NOT NULL AND l.occupied_until >= current_date) AS occupied,
    l.status, l.review_note,
    (SELECT count(*)::int FROM listing_criteria c WHERE c.listing_id = l.id AND c.met) AS met_count,
    (SELECT p.url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo_url,
    (SELECT p.alt FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo_alt,
    (SELECT array_agg(r.rating) FROM reviews r WHERE r.listing_id = l.id) AS ratings
  FROM listings l JOIN zones z ON z.id = l.zone_id JOIN users u ON u.id = l.landlord_id`

/** Strategy de orden. La lista blanca evita inyectar columnas desde la URL. */
const SORT_SQL: Record<ListingSort, string> = {
  trust: 'met_count DESC, l.monthly_rent_mxn ASC, l.id',
  price_asc: 'l.monthly_rent_mxn ASC, l.id',
  price_desc: 'l.monthly_rent_mxn DESC, l.id',
  distance: 'LEAST(l.minutes_walk, l.minutes_transit) ASC, l.id',
}

export class ListingRepository {
  constructor(private readonly db: Queryable) {}

  async search(f: ListingQuery): Promise<{ rows: ListingRow[]; total: number }> {
    const b = new SqlWhereBuilder()
      .where(`l.status = 'active'`)
      .where('(l.occupied_until IS NULL OR l.occupied_until < current_date)')
      .whereIf(f.zone, 'z.slug = $?')
      .whereIf(f.kind, 'l.kind = $?')
      .whereIf(f.maxRent, 'l.monthly_rent_mxn <= $?')
      .whereIf(f.maxMinutes, 'LEAST(l.minutes_walk, l.minutes_transit) <= $?')
      .whereIf(f.q ? `%${escapeLike(f.q)}%` : undefined, `(l.title ILIKE $? ESCAPE '\\' OR z.name ILIKE $? ESCAPE '\\')`)
    if (f.furnished) b.where('l.furnished')
    if (f.utilities) b.where('l.utilities_included')
    if (f.semester) b.where('l.semester_contract')
    if (f.verifiedOnly) b.where(`(SELECT count(*) FROM listing_criteria c WHERE c.listing_id = l.id AND c.met) = 4`)

    const where = b.toSql()
    const count = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM listings l JOIN zones z ON z.id = l.zone_id ${where}`,
      b.params,
    )
    const limit = b.params.length + 1
    const rows = await this.db.query<ListingRow>(
      `${SELECT_LISTING} ${where} ORDER BY ${SORT_SQL[f.sort]} LIMIT $${limit} OFFSET $${limit + 1}`,
      [...b.params, f.pageSize, (f.page - 1) * f.pageSize],
    )
    return { rows, total: count[0]?.n ?? 0 }
  }

  async get(id: string, q: Queryable = this.db): Promise<ListingRow | undefined> {
    const [row] = await q.query<ListingRow>(`${SELECT_LISTING} WHERE l.id = $1`, [id])
    return row
  }

  async listByLandlord(landlordId: string): Promise<ListingRow[]> {
    return this.db.query<ListingRow>(`${SELECT_LISTING} WHERE l.landlord_id = $1 AND l.status <> 'archived' ORDER BY l.created_at DESC`, [landlordId])
  }

  async listForReview(): Promise<(ListingRow & { report_count: number })[]> {
    return this.db.query(
      `SELECT x.*, (SELECT count(*)::int FROM reports r WHERE r.listing_id = x.id AND r.status = 'open') AS report_count
       FROM (${SELECT_LISTING} WHERE l.status IN ('pending_review','under_review')) x ORDER BY x.status, x.title`,
    )
  }

  /** Rentas de viviendas públicas por zona: la base de la alerta de precio. */
  async activeRents(): Promise<{ zone_id: string; kind: string; monthly_rent_mxn: number }[]> {
    return this.db.query(`SELECT zone_id, kind, monthly_rent_mxn FROM listings WHERE status = 'active'`)
  }

  async getExactAddress(id: string): Promise<string | null> {
    const [row] = await this.db.query<{ exact_address: string }>('SELECT exact_address FROM listings WHERE id = $1', [id])
    return row?.exact_address ?? null
  }

  async photos(listingId: string) {
    return this.db.query<{ id: string; url: string; alt: string }>('SELECT id, url, alt FROM listing_photos WHERE listing_id = $1 ORDER BY position', [listingId])
  }
  async photosFor(ids: string[]) {
    if (ids.length === 0) return []
    return this.db.query<{ id: string; listing_id: string; url: string; alt: string }>(
      'SELECT id, listing_id, url, alt FROM listing_photos WHERE listing_id = ANY($1) ORDER BY position',
      [ids],
    )
  }
  async addPhoto(listingId: string, url: string, alt: string) {
    const [row] = await this.db.query<{ id: string; url: string; alt: string }>(
      `INSERT INTO listing_photos (listing_id, url, alt, position)
       VALUES ($1,$2,$3,(SELECT COALESCE(max(position),-1)+1 FROM listing_photos WHERE listing_id = $1))
       RETURNING id, url, alt`,
      [listingId, url, alt],
    )
    return row!
  }
  async deletePhoto(listingId: string, photoId: string): Promise<string | null> {
    const [row] = await this.db.query<{ url: string }>('DELETE FROM listing_photos WHERE id = $1 AND listing_id = $2 RETURNING url', [photoId, listingId])
    return row?.url ?? null
  }

  async costItems(listingId: string) {
    return this.db.query<{ label: string; included: boolean; estimate_mxn: number | null }>(
      'SELECT label, included, estimate_mxn FROM listing_cost_items WHERE listing_id = $1 ORDER BY included DESC, label',
      [listingId],
    )
  }

  async criteria(listingId: string, q: Queryable = this.db) {
    return q.query<{ criterion: string; met: boolean; checked_at: Date | null }>(
      'SELECT criterion, met, checked_at FROM listing_criteria WHERE listing_id = $1',
      [listingId],
    )
  }
  async criteriaFor(ids: string[]) {
    if (ids.length === 0) return []
    return this.db.query<{ listing_id: string; criterion: string; met: boolean; checked_at: Date | null }>(
      'SELECT listing_id, criterion, met, checked_at FROM listing_criteria WHERE listing_id = ANY($1)',
      [ids],
    )
  }
  async setCriterion(listingId: string, criterion: string, met: boolean, adminId: string, q: Queryable) {
    await q.query(
      `INSERT INTO listing_criteria (listing_id, criterion, met, checked_by, checked_at) VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (listing_id, criterion) DO UPDATE SET met = $3, checked_by = $4, checked_at = now()`,
      [listingId, criterion, met, adminId],
    )
  }

  async inputOf(id: string): Promise<(ListingInput & { landlordId: string }) | undefined> {
    const [r] = await this.db.query<Record<string, never>>(
      `SELECT zone_id, title, description, kind, monthly_rent_mxn, deposit_months, min_months, semester_contract, minutes_walk,
         minutes_transit, furnished, utilities_included, air_conditioning, exact_address, available_from::text AS available_from, landlord_id
       FROM listings WHERE id = $1`,
      [id],
    )
    if (!r) return undefined
    const items = await this.costItems(id)
    const row = r as Record<string, unknown>
    return {
      landlordId: row.landlord_id as string,
      zoneId: row.zone_id as string,
      title: row.title as string,
      description: row.description as string,
      kind: row.kind as ListingInput['kind'],
      monthlyRentMxn: row.monthly_rent_mxn as number,
      depositMonths: row.deposit_months as number,
      minMonths: row.min_months as number,
      semesterContract: row.semester_contract as boolean,
      minutesWalk: row.minutes_walk as number,
      minutesTransit: row.minutes_transit as number,
      furnished: row.furnished as boolean,
      utilitiesIncluded: row.utilities_included as boolean,
      airConditioning: row.air_conditioning as boolean,
      exactAddress: row.exact_address as string,
      availableFrom: row.available_from as string,
      costItems: items.map((i) => ({ label: i.label, included: i.included, estimateMxn: i.estimate_mxn })),
    }
  }

  async insert(landlordId: string, input: ListingInput, coords: { lat: number; lng: number }, q: Queryable): Promise<string> {
    const [row] = await q.query<{ id: string }>(
      `INSERT INTO listings (landlord_id, zone_id, title, description, kind, monthly_rent_mxn, deposit_months, min_months, semester_contract,
         minutes_walk, minutes_transit, furnished, utilities_included, air_conditioning, approx_lat, approx_lng, exact_address, available_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [
        landlordId, input.zoneId, input.title, input.description, input.kind, input.monthlyRentMxn, input.depositMonths, input.minMonths,
        input.semesterContract, input.minutesWalk, input.minutesTransit, input.furnished, input.utilitiesIncluded, input.airConditioning,
        coords.lat, coords.lng, input.exactAddress, input.availableFrom,
      ],
    )
    await this.replaceCostItems(row!.id, input, q)
    return row!.id
  }

  async update(id: string, input: ListingInput, coords: { lat: number; lng: number }, status: string, q: Queryable): Promise<void> {
    await q.query(
      `UPDATE listings SET zone_id=$2, title=$3, description=$4, kind=$5, monthly_rent_mxn=$6, deposit_months=$7, min_months=$8, semester_contract=$9,
         minutes_walk=$10, minutes_transit=$11, furnished=$12, utilities_included=$13, air_conditioning=$14, approx_lat=$15, approx_lng=$16,
         exact_address=$17, available_from=$18, status=$19, updated_at=now() WHERE id=$1`,
      [
        id, input.zoneId, input.title, input.description, input.kind, input.monthlyRentMxn, input.depositMonths, input.minMonths,
        input.semesterContract, input.minutesWalk, input.minutesTransit, input.furnished, input.utilitiesIncluded, input.airConditioning,
        coords.lat, coords.lng, input.exactAddress, input.availableFrom, status,
      ],
    )
    await this.replaceCostItems(id, input, q)
  }

  private async replaceCostItems(listingId: string, input: ListingInput, q: Queryable): Promise<void> {
    await q.query('DELETE FROM listing_cost_items WHERE listing_id = $1', [listingId])
    for (const item of input.costItems) {
      await q.query('INSERT INTO listing_cost_items (listing_id, label, included, estimate_mxn) VALUES ($1,$2,$3,$4)', [
        listingId, item.label, item.included, item.estimateMxn ?? null,
      ])
    }
  }

  async setStatus(id: string, status: ListingRow['status'], note: string | null, q: Queryable = this.db): Promise<void> {
    await q.query('UPDATE listings SET status = $2, review_note = $3, updated_at = now() WHERE id = $1', [id, status, note])
  }

  async zoneCoords(zoneId: string): Promise<{ lat: number; lng: number } | undefined> {
    const [z] = await this.db.query<{ lat: number; lng: number }>('SELECT lat, lng FROM zones WHERE id = $1', [zoneId])
    return z
  }

  async zones(): Promise<Omit<Zone, 'medianRentMxn' | 'listingCount'>[]> {
    const rows = await this.db.query<{ id: string; slug: string; name: string; lat: number; lng: number; transit_note: string; life_note: string }>('SELECT * FROM zones ORDER BY name')
    return rows.map((z) => ({ id: z.id, slug: z.slug, name: z.name, lat: z.lat, lng: z.lng, transitNote: z.transit_note, lifeNote: z.life_note }))
  }

  async pendingBookingCounts(landlordId: string): Promise<Map<string, number>> {
    const rows = await this.db.query<{ listing_id: string; n: number }>(
      `SELECT b.listing_id, count(*)::int AS n FROM bookings b JOIN listings l ON l.id = b.listing_id
       WHERE l.landlord_id = $1 AND b.status IN ('requested','tour_scheduled') GROUP BY b.listing_id`,
      [landlordId],
    )
    return new Map(rows.map((r) => [r.listing_id, r.n]))
  }
}
