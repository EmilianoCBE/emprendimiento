import type { AdminMetrics, AuditEntry, Paged } from '@aterriza/contracts'
import type { Queryable } from '../../platform/db.ts'

/** Lectura para operación. Las escrituras de administración viven en el módulo dueño de cada dato. */
export class AdminReadService {
  constructor(private readonly db: Queryable) {}

  async metrics(): Promise<AdminMetrics> {
    const [m] = await this.db.query<AdminMetrics>(`SELECT
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS "users",
      (SELECT count(*)::int FROM users WHERE student_status = 'verified') AS "validatedStudents",
      (SELECT count(*)::int FROM listings WHERE status = 'active') AS "activeListings",
      (SELECT count(*)::int FROM listings l WHERE status = 'active'
        AND (SELECT count(*) FROM listing_criteria c WHERE c.listing_id = l.id AND c.met) = 4) AS "verifiedListings",
      (SELECT count(*)::int FROM listings WHERE status IN ('pending_review','under_review')) AS "pendingListings",
      (SELECT count(*)::int FROM reports WHERE status = 'open') AS "openReports",
      (SELECT count(*)::int FROM bookings) AS "bookings",
      (SELECT count(*)::int FROM conversations) AS "conversations",
      (SELECT count(*)::int FROM messages WHERE cardinality(risk_flags) > 0) AS "flaggedMessages"`)
    return m!
  }

  async audit(page: number, pageSize = 30): Promise<Paged<AuditEntry>> {
    const [count] = await this.db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_log')
    const rows = await this.db.query<{ id: string; full_name: string | null; action: string; entity: string; entity_id: string | null; created_at: Date }>(
      `SELECT a.id, u.full_name, a.action, a.entity, a.entity_id, a.created_at
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize],
    )
    return {
      items: rows.map((r) => ({ id: r.id, actorName: r.full_name, action: r.action, entity: r.entity, entityId: r.entity_id, createdAt: r.created_at.toISOString() })),
      total: count?.n ?? 0,
      page,
      pageSize,
    }
  }
}
