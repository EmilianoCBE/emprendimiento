/** Piezas transversales pequeñas: errores, actor, eventos, correo, auditoría. */
import type { Role, StudentStatus } from '@aterriza/contracts'
import type { Queryable } from './db.ts'

// ---------- Errores de negocio ----------
export type ErrorKind = 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'unprocessable'

const STATUS: Record<ErrorKind, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
}

export class DomainError extends Error {
  readonly status: number
  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message)
    this.status = STATUS[kind]
  }
}

/** Mismo error si algo no existe o no es tuyo: no revela qué recursos hay. */
export const notFound = (what = 'Lo que buscas') => new DomainError('not_found', 'not_found', `${what} no existe o no tienes acceso.`)

// ---------- Actor ----------
export interface Actor {
  id: string
  role: Role
  studentStatus: StudentStatus
  fullName: string
  email: string
}

// ---------- Observer ----------
export type DomainEvent =
  | { type: 'booking.requested'; bookingId: string; landlordId: string; studentName: string; listingTitle: string }
  | { type: 'booking.changed'; bookingId: string; recipientId: string; status: string; listingTitle: string; tourAt?: string | null }
  | { type: 'listing.decided'; listingId: string; landlordId: string; decision: 'approve' | 'return' | 'archive'; title: string; note?: string }
  | { type: 'listing.flagged'; listingId: string; title: string; landlordId: string }
  | { type: 'student.decided'; userId: string; approved: boolean }
  | { type: 'mentor.decided'; userId: string; approved: boolean }
  | { type: 'connection.requested'; conversationId: string; mentorId: string; studentName: string }
  | { type: 'connection.answered'; conversationId: string; studentId: string; mentorName: string; accepted: boolean }
  | { type: 'message.sent'; conversationId: string; recipientId: string; senderId: string; senderName: string; message: unknown; risky: boolean }

export type EventHandler = (event: DomainEvent) => Promise<void> | void

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}

export class EventBus implements EventPublisher {
  private readonly handlers: EventHandler[] = []
  constructor(private readonly onError: (err: unknown) => void = () => {}) {}

  subscribe(handler: EventHandler): void {
    this.handlers.push(handler)
  }
  /** Un suscriptor que falla no debe tirar la operación que ya se confirmó. */
  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event)
      } catch (err) {
        this.onError(err)
      }
    }
  }
}

// ---------- Correo ----------
export interface Mailer {
  send(mail: { to: string; subject: string; text: string }): Promise<void>
}

/** Solo para desarrollo: no envía nada y nunca escribe el contenido del mensaje en los logs. */
export class ConsoleMailer implements Mailer {
  constructor(private readonly log: (msg: string) => void = () => {}) {}
  async send({ subject }: { to: string; subject: string; text: string }): Promise<void> {
    this.log(`[correo simulado] ${subject}`)
  }
}

// ---------- Auditoría ----------
export interface AuditLog {
  record(entry: { actorId: string | null; action: string; entity: string; entityId?: string; meta?: Record<string, unknown> }, q?: Queryable): Promise<void>
}

export class SqlAuditLog implements AuditLog {
  constructor(private readonly db: Queryable) {}
  async record(
    entry: { actorId: string | null; action: string; entity: string; entityId?: string; meta?: Record<string, unknown> },
    q: Queryable = this.db,
  ): Promise<void> {
    await q.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5::jsonb)', [
      entry.actorId,
      entry.action,
      entry.entity,
      entry.entityId ?? null,
      JSON.stringify(entry.meta ?? {}),
    ])
  }
}

// ---------- Archivos ----------
export interface FileStore {
  save(bytes: Buffer, extension: string): Promise<string>
  remove(url: string): Promise<void>
}
