import type { ChatMessage, Conversation, MentorCard, PendingMentor } from '@aterriza/contracts'
import type { Db, Queryable } from '../../platform/db.ts'
import { type Actor, type AuditLog, DomainError, type EventPublisher, notFound } from '../../platform/kernel.ts'
import { RISK_LABEL, detectScamSignals } from '../trust/domain.ts'

interface MentorRow {
  id: string
  full_name: string
  home_country: string | null
  kind: MentorCard['kind']
  university: string
  headline: string
  bio: string
  languages: string[]
  topics: string[]
  zone_name: string | null
  zone_slug: string | null
  accepting: boolean
  email: string
}

const SELECT_MENTOR = `
  SELECT u.id, u.full_name, u.home_country, u.email, m.kind, m.university, m.headline, m.bio, m.languages, m.topics,
    z.name AS zone_name, z.slug AS zone_slug, m.accepting
  FROM mentor_profiles m JOIN users u ON u.id = m.user_id LEFT JOIN zones z ON z.id = m.zone_id`

const toMentor = (r: MentorRow): MentorCard => ({
  id: r.id,
  fullName: r.full_name,
  kind: r.kind,
  university: r.university,
  headline: r.headline,
  bio: r.bio,
  languages: r.languages,
  topics: r.topics,
  zoneName: r.zone_name,
  zoneSlug: r.zone_slug,
  homeCountry: r.home_country,
  accepting: r.accepting,
})

interface ConversationRow {
  id: string
  kind: Conversation['kind']
  status: Conversation['status']
  intro: string | null
  student_id: string
  counterpart_id: string
  student_name: string
  counterpart_name: string
  mentor_headline: string | null
  listing_title: string | null
  last_message_at: Date | null
  last_message: string | null
  unread: number
}

const SELECT_CONVERSATION = `
  SELECT c.id, c.kind, c.status, c.intro, c.student_id, c.counterpart_id, s.full_name AS student_name, o.full_name AS counterpart_name,
    m.university AS mentor_headline, l.title AS listing_title, c.last_message_at,
    (SELECT body FROM messages x WHERE x.conversation_id = c.id ORDER BY x.created_at DESC LIMIT 1) AS last_message,
    (SELECT count(*)::int FROM messages x WHERE x.conversation_id = c.id AND x.sender_id <> $1 AND x.read_at IS NULL) AS unread
  FROM conversations c JOIN users s ON s.id = c.student_id JOIN users o ON o.id = c.counterpart_id
  LEFT JOIN mentor_profiles m ON m.user_id = c.counterpart_id AND c.kind = 'mentor'
  LEFT JOIN bookings b ON b.id = c.booking_id LEFT JOIN listings l ON l.id = b.listing_id`

const toMessage = (m: { id: string; conversation_id: string; sender_id: string; body: string; risk_flags: string[]; created_at: Date }): ChatMessage => ({
  id: m.id,
  conversationId: m.conversation_id,
  senderId: m.sender_id,
  body: m.body,
  riskFlags: m.risk_flags.map((id) => ({ id, label: RISK_LABEL[id] ?? id })),
  createdAt: m.created_at.toISOString(),
})

export class CommunityService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditLog,
    private readonly events: EventPublisher,
  ) {}

  // ---------- Mentores ----------
  async searchMentors(f: { kind?: string; language?: string; topic?: string; zone?: string }): Promise<MentorCard[]> {
    const rows = await this.db.query<MentorRow>(
      `${SELECT_MENTOR}
       WHERE m.status = 'approved' AND u.deleted_at IS NULL
         AND ($1::text IS NULL OR m.kind = $1)
         AND ($2::text IS NULL OR $2 = ANY(m.languages))
         AND ($3::text IS NULL OR $3 = ANY(m.topics))
         AND ($4::text IS NULL OR z.slug = $4)
       ORDER BY m.accepting DESC, u.full_name LIMIT 60`,
      [f.kind ?? null, f.language ?? null, f.topic ?? null, f.zone ?? null],
    )
    return rows.map(toMentor)
  }

  async getMentor(id: string): Promise<MentorCard> {
    const [row] = await this.db.query<MentorRow>(`${SELECT_MENTOR} WHERE u.id = $1 AND m.status = 'approved' AND u.deleted_at IS NULL`, [id])
    if (!row) throw notFound('El mentor')
    return toMentor(row)
  }

  async forZone(zoneSlug: string, limit: number): Promise<MentorCard[]> {
    const rows = await this.db.query<MentorRow>(
      `${SELECT_MENTOR} WHERE m.status = 'approved' AND m.accepting AND u.deleted_at IS NULL AND z.slug = $1 ORDER BY u.full_name LIMIT $2`,
      [zoneSlug, limit],
    )
    return rows.map(toMentor)
  }

  async getOwnProfile(actor: Actor) {
    const [row] = await this.db.query<Record<string, unknown>>(
      'SELECT kind, university, headline, bio, languages, topics, zone_id, status, accepting FROM mentor_profiles WHERE user_id = $1',
      [actor.id],
    )
    return row ?? null
  }

  async upsertProfile(actor: Actor, p: { kind: string; university: string; headline: string; bio: string; languages: string[]; topics: string[]; zoneId?: string | null; accepting: boolean }): Promise<void> {
    if (p.zoneId) {
      const [z] = await this.db.query('SELECT 1 FROM zones WHERE id = $1', [p.zoneId])
      if (!z) throw new DomainError('bad_request', 'invalid_zone', 'Elige una zona válida.')
    }
    // Editar el perfil público lo devuelve a revisión, salvo cambiar la disponibilidad.
    await this.db.query(
      `INSERT INTO mentor_profiles (user_id, kind, university, headline, bio, languages, topics, zone_id, accepting)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id) DO UPDATE SET kind=$2, university=$3, headline=$4, bio=$5, languages=$6, topics=$7, zone_id=$8, accepting=$9,
         status = CASE WHEN mentor_profiles.university=$3 AND mentor_profiles.headline=$4 AND mentor_profiles.bio=$5 AND mentor_profiles.kind=$2
                       THEN mentor_profiles.status ELSE 'pending' END,
         updated_at = now()`,
      [actor.id, p.kind, p.university, p.headline, p.bio, p.languages, p.topics, p.zoneId ?? null, p.accepting],
    )
    await this.audit.record({ actorId: actor.id, action: 'mentor.profile_saved', entity: 'mentor', entityId: actor.id })
  }

  async pendingMentors(): Promise<PendingMentor[]> {
    const rows = await this.db.query<MentorRow>(`${SELECT_MENTOR} WHERE m.status = 'pending' AND u.deleted_at IS NULL ORDER BY m.created_at`)
    return rows.map((r) => ({ ...toMentor(r), email: r.email }))
  }

  async decideMentor(admin: Actor, userId: string, approve: boolean): Promise<void> {
    const rows = await this.db.query(`UPDATE mentor_profiles SET status = $2, updated_at = now() WHERE user_id = $1 AND status = 'pending' RETURNING user_id`, [userId, approve ? 'approved' : 'rejected'])
    if (rows.length === 0) throw notFound('El perfil')
    await this.audit.record({ actorId: admin.id, action: approve ? 'mentor.approved' : 'mentor.rejected', entity: 'mentor', entityId: userId })
    await this.events.publish({ type: 'mentor.decided', userId, approved: approve })
  }

  // ---------- Conexión ----------
  async connect(actor: Actor, mentorId: string, intro: string): Promise<{ conversationId: string }> {
    const mentor = await this.getMentor(mentorId)
    if (!mentor.accepting) throw new DomainError('conflict', 'mentor_unavailable', `${mentor.fullName} no está recibiendo solicitudes por ahora.`)
    if (mentorId === actor.id) throw new DomainError('bad_request', 'self_connect', 'No puedes conectarte contigo.')
    const conversationId = await this.db
      .query<{ id: string }>(
        `INSERT INTO conversations (kind, student_id, counterpart_id, status, intro) VALUES ('mentor',$1,$2,'pending',$3) RETURNING id`,
        [actor.id, mentorId, intro],
      )
      .then((r) => r[0]!.id)
      .catch((err: { code?: string }) => {
        if (err.code === '23505') throw new DomainError('conflict', 'already_connected', 'Ya tienes una conversación con esta persona.')
        throw err
      })
    await this.audit.record({ actorId: actor.id, action: 'connection.requested', entity: 'conversation', entityId: conversationId })
    await this.events.publish({ type: 'connection.requested', conversationId, mentorId, studentName: actor.fullName })
    return { conversationId }
  }

  async respond(actor: Actor, conversationId: string, accept: boolean): Promise<void> {
    const c = await this.participantConversation(actor, conversationId)
    if (c.counterpart_id !== actor.id || c.kind !== 'mentor') throw notFound('La conversación')
    if (c.status !== 'pending') throw new DomainError('conflict', 'already_answered', 'Esta solicitud ya se respondió.')
    await this.db.tx(async (tx) => {
      await tx.query('UPDATE conversations SET status = $2, last_message_at = now() WHERE id = $1', [conversationId, accept ? 'active' : 'declined'])
      if (accept && c.intro) await this.insertMessage(tx, conversationId, c.student_id, c.intro)
    })
    await this.events.publish({ type: 'connection.answered', conversationId, studentId: c.student_id, mentorName: actor.fullName, accepted: accept })
  }

  // ---------- Conversaciones ----------
  private async participantConversation(actor: Actor, id: string): Promise<ConversationRow> {
    const [c] = await this.db.query<ConversationRow>(`${SELECT_CONVERSATION} WHERE c.id = $2 AND (c.student_id = $1 OR c.counterpart_id = $1)`, [actor.id, id])
    if (!c) throw notFound('La conversación')
    return c
  }

  private toConversation(c: ConversationRow, actor: Actor): Conversation {
    const iAmStudent = c.student_id === actor.id
    return {
      id: c.id,
      kind: c.kind,
      status: c.status,
      intro: c.intro,
      otherName: iAmStudent ? c.counterpart_name : c.student_name,
      otherSubtitle: c.kind === 'mentor' ? (iAmStudent ? c.mentor_headline : 'Estudiante') : iAmStudent ? 'Arrendador' : 'Estudiante',
      iAmStudent,
      lastMessageAt: c.last_message_at ? c.last_message_at.toISOString() : null,
      lastMessage: c.last_message,
      unread: c.unread,
      listingTitle: c.listing_title,
    }
  }

  async listConversations(actor: Actor): Promise<Conversation[]> {
    const rows = await this.db.query<ConversationRow>(
      `${SELECT_CONVERSATION} WHERE c.student_id = $1 OR c.counterpart_id = $1 ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [actor.id],
    )
    return rows.map((c) => this.toConversation(c, actor))
  }

  async getConversation(actor: Actor, id: string): Promise<Conversation> {
    return this.toConversation(await this.participantConversation(actor, id), actor)
  }

  async messages(actor: Actor, id: string, before?: string): Promise<ChatMessage[]> {
    await this.participantConversation(actor, id)
    const rows = await this.db.query<{ id: string; conversation_id: string; sender_id: string; body: string; risk_flags: string[]; created_at: Date }>(
      `SELECT id, conversation_id, sender_id, body, risk_flags, created_at FROM messages
       WHERE conversation_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2) ORDER BY created_at DESC LIMIT 100`,
      [id, before ?? null],
    )
    await this.db.query('UPDATE messages SET read_at = now() WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL', [id, actor.id])
    return rows.reverse().map(toMessage)
  }

  private async insertMessage(q: Queryable, conversationId: string, senderId: string, body: string): Promise<ChatMessage> {
    const flags = detectScamSignals(body)
    const [m] = await q.query<{ id: string; conversation_id: string; sender_id: string; body: string; risk_flags: string[]; created_at: Date }>(
      `INSERT INTO messages (conversation_id, sender_id, body, risk_flags) VALUES ($1,$2,$3,$4)
       RETURNING id, conversation_id, sender_id, body, risk_flags, created_at`,
      [conversationId, senderId, body, flags],
    )
    return toMessage(m!)
  }

  async send(actor: Actor, id: string, body: string): Promise<ChatMessage> {
    const c = await this.participantConversation(actor, id)
    if (c.status !== 'active') throw new DomainError('conflict', 'conversation_inactive', 'Esta conversación no admite mensajes.')
    const message = await this.db.tx(async (tx) => {
      const m = await this.insertMessage(tx, id, actor.id, body)
      await tx.query('UPDATE conversations SET last_message_at = now() WHERE id = $1', [id])
      return m
    })
    const recipientId = c.student_id === actor.id ? c.counterpart_id : c.student_id
    await this.events.publish({ type: 'message.sent', conversationId: id, recipientId, senderId: actor.id, senderName: actor.fullName, message, risky: message.riskFlags.length > 0 })
    return message
  }
}
