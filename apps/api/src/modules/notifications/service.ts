import type { ServerResponse } from 'node:http'
import type { AppNotification } from '@aterriza/contracts'
import type { Queryable } from '../../platform/db.ts'
import type { DomainEvent } from '../../platform/kernel.ts'

const MAX_CONNECTIONS_PER_USER = 5

/** Reparte eventos en vivo por SSE. En memoria: sirve para una instancia (ADR 7). */
export class SseHub {
  private readonly clients = new Map<string, Set<ServerResponse>>()

  add(userId: string, res: ServerResponse): void {
    const set = this.clients.get(userId) ?? new Set()
    if (set.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = set.values().next().value
      if (oldest) {
        set.delete(oldest)
        oldest.end()
      }
    }
    set.add(res)
    this.clients.set(userId, set)
    res.on('close', () => {
      set.delete(res)
      if (set.size === 0) this.clients.delete(userId)
    })
  }

  /** Una sesión cerrada no debe seguir recibiendo eventos. Si otra sigue vigente, el navegador se reconecta. */
  disconnect(userId: string): void {
    for (const res of this.clients.get(userId) ?? []) res.end()
    this.clients.delete(userId)
  }

  send(userId: string, event: string, data: unknown): void {
    for (const res of this.clients.get(userId) ?? []) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
  }

  heartbeat(): void {
    for (const set of this.clients.values()) for (const res of set) res.write(': ping\n\n')
  }

  disconnectAll(): void {
    for (const set of this.clients.values()) for (const res of set) res.end()
    this.clients.clear()
  }
}

const STATUS_COPY: Record<string, string> = {
  tour_scheduled: 'Se agendó una videollamada',
  accepted: 'Tu solicitud fue aceptada; ya puedes ver la dirección',
  rejected: 'La solicitud fue rechazada',
  cancelled: 'La solicitud se canceló',
  confirmed: 'El estudiante confirmó el contrato firmado',
  completed: 'La estancia concluyó; ya puedes dejar tu reseña',
}

interface Draft {
  userId: string
  type: string
  title: string
  body: string
  link: string | null
}

/** Observer: traduce eventos de dominio en avisos para la persona. */
export function notificationFor(e: DomainEvent): Draft | null {
  switch (e.type) {
    case 'booking.requested':
      return { userId: e.landlordId, type: e.type, title: 'Nueva solicitud', body: `${e.studentName} solicitó ${e.listingTitle}`, link: `/solicitudes/${e.bookingId}` }
    case 'booking.changed':
      return { userId: e.recipientId, type: e.type, title: STATUS_COPY[e.status] ?? 'Tu solicitud cambió', body: e.listingTitle, link: `/solicitudes/${e.bookingId}` }
    case 'listing.decided': {
      const title = e.decision === 'approve' ? 'Tu vivienda ya está publicada' : e.decision === 'return' ? 'Tu vivienda necesita cambios' : 'Tu vivienda se archivó'
      return { userId: e.landlordId, type: e.type, title, body: e.note || e.title, link: '/mis-viviendas' }
    }
    case 'listing.flagged':
      return { userId: e.landlordId, type: e.type, title: 'Tu vivienda está en revisión', body: `${e.title} recibió varios reportes y no aparece en la búsqueda mientras la revisamos.`, link: '/mis-viviendas' }
    case 'student.decided':
      return e.approved
        ? { userId: e.userId, type: e.type, title: 'Tu matrícula quedó validada', body: 'Ya puedes solicitar viviendas y hablar con mentores.', link: '/viviendas' }
        : { userId: e.userId, type: e.type, title: 'No pudimos validar tu matrícula', body: 'Revísala y vuelve a enviarla desde tu cuenta.', link: '/cuenta' }
    case 'mentor.decided':
      return { userId: e.userId, type: e.type, title: e.approved ? 'Tu perfil de mentor ya es público' : 'Tu perfil de mentor no se aprobó', body: e.approved ? 'Los estudiantes ya pueden escribirte.' : 'Revisa tu información y vuelve a enviarla.', link: '/cuenta' }
    case 'connection.requested':
      return { userId: e.mentorId, type: e.type, title: 'Alguien quiere hablar contigo', body: `${e.studentName} te envió una solicitud`, link: `/mensajes/${e.conversationId}` }
    case 'connection.answered':
      return { userId: e.studentId, type: e.type, title: e.accepted ? `${e.mentorName} aceptó tu solicitud` : `${e.mentorName} no puede atenderte por ahora`, body: e.accepted ? 'Ya pueden conversar.' : 'Busca a otro mentor en el directorio.', link: e.accepted ? `/mensajes/${e.conversationId}` : '/mentores' }
    case 'message.sent':
      return { userId: e.recipientId, type: e.type, title: `Mensaje de ${e.senderName}`, body: e.risky ? 'Este mensaje tiene una señal de riesgo. Léelo con cuidado.' : 'Tienes un mensaje nuevo.', link: `/mensajes/${e.conversationId}` }
  }
}

export class NotificationService {
  constructor(
    private readonly db: Queryable,
    private readonly hub: SseHub,
  ) {}

  handle = async (event: DomainEvent): Promise<void> => {
    if (event.type === 'message.sent') this.hub.send(event.recipientId, 'message', event.message)
    if (event.type === 'connection.requested') this.hub.send(event.mentorId, 'conversation', { id: event.conversationId })
    if (event.type === 'connection.answered') this.hub.send(event.studentId, 'conversation', { id: event.conversationId })
    if (event.type === 'booking.requested') this.hub.send(event.landlordId, 'booking', { id: event.bookingId })
    if (event.type === 'booking.changed') this.hub.send(event.recipientId, 'booking', { id: event.bookingId })

    const draft = notificationFor(event)
    if (!draft) return
    // Varios mensajes seguidos del mismo chat generan un solo aviso.
    if (event.type === 'message.sent' && !event.risky) {
      const [existing] = await this.db.query('SELECT 1 FROM notifications WHERE user_id = $1 AND link = $2 AND read_at IS NULL LIMIT 1', [draft.userId, draft.link])
      if (existing) return
    }
    const [row] = await this.db.query<NotificationRow>(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, type, title, body, link, read_at, created_at`,
      [draft.userId, draft.type, draft.title, draft.body, draft.link],
    )
    this.hub.send(draft.userId, 'notification', toNotification(row!))
  }

  async list(userId: string): Promise<{ items: AppNotification[]; unread: number }> {
    const rows = await this.db.query<NotificationRow>(
      'SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [userId],
    )
    const [c] = await this.db.query<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])
    return { items: rows.map(toNotification), unread: c?.n ?? 0 }
  }

  async readAll(userId: string): Promise<void> {
    await this.db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId])
  }
}

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read_at: Date | null
  created_at: Date
}
const toNotification = (n: NotificationRow): AppNotification => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  link: n.link,
  readAt: n.read_at ? n.read_at.toISOString() : null,
  createdAt: n.created_at.toISOString(),
})
