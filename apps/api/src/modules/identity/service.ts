import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2'
import type { CodeSentResponse, Me, PendingStudent, Role, StudentStatus } from '@aterriza/contracts'
import type { Db, Queryable } from '../../platform/db.ts'
import { type Actor, type AuditLog, DomainError, type EventPublisher, type Mailer, notFound } from '../../platform/kernel.ts'
import {
  CODE_MAX_ATTEMPTS,
  CODE_MINUTES,
  LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  SESSION_DAYS,
  SESSION_IDLE_HOURS,
  passwordProblems,
  validationMethodFor,
} from './domain.ts'

interface UserRow {
  id: string
  email: string
  password_hash: string
  full_name: string
  role: Role
  home_country: string | null
  student_status: StudentStatus
  matricula: string | null
  email_verified_at: Date | null
  failed_logins: number
  locked_until: Date | null
  deleted_at: Date | null
}

export interface IdentityOptions {
  appSecret: string
  institutionalDomains: string[]
  demoMode: boolean
}

const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } // OWASP, perfil mínimo recomendado.

export const hashPassword = (password: string) => argonHash(password, ARGON)
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export function toMe(u: UserRow): Me {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    homeCountry: u.home_country,
    studentStatus: u.student_status,
    matricula: u.matricula,
    emailVerified: u.email_verified_at !== null,
  }
}

export class IdentityService {
  /** Se verifica contra este hash si el usuario no existe, para que el tiempo de respuesta no lo delate. */
  private dummyHash: Promise<string> | null = null

  constructor(
    private readonly db: Db,
    private readonly mailer: Mailer,
    private readonly audit: AuditLog,
    private readonly events: EventPublisher,
    private readonly opts: IdentityOptions,
  ) {}

  // ---------- Registro ----------
  async register(input: { email: string; password: string; fullName: string; role: Role; homeCountry?: string }): Promise<CodeSentResponse> {
    const problems = passwordProblems(input.password, input.email)
    if (problems.length > 0) throw new DomainError('bad_request', 'weak_password', 'Elige otra contraseña.', problems)

    const passwordHash = await hashPassword(input.password)
    const existing = await this.findByEmail(input.email)
    if (existing) {
      // Misma respuesta que un registro nuevo: no revela qué correos existen.
      if (!existing.email_verified_at && !existing.deleted_at) return this.sendCode(existing, 'verify_email')
      return { ok: true }
    }
    const [user] = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, role, home_country)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.email, passwordHash, input.fullName, input.role, input.homeCountry ?? null],
    )
    await this.audit.record({ actorId: user!.id, action: 'user.registered', entity: 'user', entityId: user!.id, meta: { role: input.role } })
    return this.sendCode(user!, 'verify_email')
  }

  async resendCode(email: string): Promise<CodeSentResponse> {
    const user = await this.findByEmail(email)
    if (!user || user.email_verified_at || user.deleted_at) return { ok: true }
    return this.sendCode(user, 'verify_email')
  }

  private async sendCode(user: UserRow, purpose: 'verify_email' | 'reset_password'): Promise<CodeSentResponse> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await this.db.tx(async (tx) => {
      await tx.query('UPDATE one_time_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL', [user.id, purpose])
      await tx.query(
        `INSERT INTO one_time_codes (user_id, purpose, code_hash, expires_at)
         VALUES ($1,$2,$3, now() + make_interval(mins => $4))`,
        [user.id, purpose, this.hashCode(user.id, code), CODE_MINUTES],
      )
    })
    const subject = purpose === 'verify_email' ? 'Tu código para confirmar tu correo' : 'Tu código para cambiar tu contraseña'
    await this.mailer.send({ to: user.email, subject, text: `Tu código es ${code}. Caduca en ${CODE_MINUTES} minutos.` })
    return this.opts.demoMode ? { ok: true, devCode: code } : { ok: true }
  }

  private hashCode(userId: string, code: string): string {
    return createHmac('sha256', this.opts.appSecret).update(`${userId}:${code}`).digest('hex')
  }

  /** Consume el código si es correcto. Cada intento fallido cuenta; a los 5 queda inútil. */
  private async consumeCode(userId: string, purpose: 'verify_email' | 'reset_password', code: string, q: Queryable): Promise<boolean> {
    const [row] = await q.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM one_time_codes
       WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, purpose],
    )
    if (!row || row.attempts >= CODE_MAX_ATTEMPTS) return false
    const a = Buffer.from(row.code_hash, 'hex')
    const b = Buffer.from(this.hashCode(userId, code), 'hex')
    if (a.length === b.length && timingSafeEqual(a, b)) {
      await q.query('UPDATE one_time_codes SET consumed_at = now() WHERE id = $1', [row.id])
      return true
    }
    await q.query('UPDATE one_time_codes SET attempts = attempts + 1 WHERE id = $1', [row.id])
    return false
  }

  async verifyEmail(email: string, code: string): Promise<{ token: string; me: Me }> {
    const invalid = new DomainError('bad_request', 'invalid_code', 'El código no es correcto o ya caducó. Pide uno nuevo.')
    const user = await this.findByEmail(email)
    if (!user || user.deleted_at) throw invalid
    const ok = await this.db.tx(async (tx) => {
      const valid = await this.consumeCode(user.id, 'verify_email', code, tx)
      if (valid) await tx.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [user.id])
      return valid
    })
    if (!ok) throw invalid
    const token = await this.createSession(user.id)
    return { token, me: toMe({ ...user, email_verified_at: new Date() }) }
  }

  // ---------- Sesión ----------
  async login(email: string, password: string): Promise<{ token: string; me: Me }> {
    const invalid = new DomainError('unauthorized', 'invalid_credentials', 'Correo o contraseña incorrectos.')
    const user = await this.findByEmail(email)
    if (!user || user.deleted_at) {
      await this.burnTime(password)
      throw invalid
    }
    if (user.locked_until && user.locked_until > new Date()) {
      await this.burnTime(password)
      throw new DomainError('unauthorized', 'account_locked', `Por seguridad, espera ${LOCK_MINUTES} minutos antes de volver a intentar.`)
    }
    if (!(await argonVerify(user.password_hash, password))) {
      const failures = user.failed_logins + 1
      const lock = failures >= LOGIN_MAX_FAILURES
      await this.db.query(
        `UPDATE users SET failed_logins = $2, locked_until = CASE WHEN $3::boolean THEN now() + make_interval(mins => $4) ELSE locked_until END WHERE id = $1`,
        [user.id, lock ? 0 : failures, lock, LOCK_MINUTES],
      )
      if (lock) await this.audit.record({ actorId: user.id, action: 'user.locked', entity: 'user', entityId: user.id })
      throw invalid
    }
    if (!user.email_verified_at) {
      // Solo se llega aquí con la contraseña correcta: no permite enumerar correos.
      throw new DomainError('forbidden', 'email_not_verified', 'Confirma tu correo para entrar.')
    }
    await this.db.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id])
    return { token: await this.createSession(user.id), me: toMe(user) }
  }

  private async burnTime(password: string): Promise<void> {
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
    await argonVerify(await this.dummyHash, password).catch(() => false)
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    await this.db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2, now() + make_interval(days => $3))`,
      [userId, sha256(token), SESSION_DAYS],
    )
    return token
  }

  async resolveSession(token: string | undefined): Promise<Actor | null> {
    if (!token || token.length > 128) return null
    const [row] = await this.db.query<UserRow & { session_id: string; last_seen_at: Date }>(
      `SELECT u.*, s.id AS session_id, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()
         AND s.last_seen_at > now() - make_interval(hours => $2) AND u.deleted_at IS NULL`,
      [sha256(token), SESSION_IDLE_HOURS],
    )
    if (!row) return null
    if (Date.now() - row.last_seen_at.getTime() > 5 * 60_000) {
      await this.db.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.session_id])
    }
    return { id: row.id, role: row.role, studentStatus: row.student_status, fullName: row.full_name, email: row.email }
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
  }
  async logoutAll(userId: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    await this.audit.record({ actorId: userId, action: 'user.logout_all', entity: 'user', entityId: userId })
  }

  // ---------- Recuperación ----------
  async forgotPassword(email: string): Promise<CodeSentResponse> {
    const user = await this.findByEmail(email)
    if (!user || user.deleted_at) return { ok: true }
    return this.sendCode(user, 'reset_password')
  }

  async resetPassword(email: string, code: string, password: string): Promise<string> {
    const problems = passwordProblems(password, email)
    if (problems.length > 0) throw new DomainError('bad_request', 'weak_password', 'Elige otra contraseña.', problems)
    const invalid = new DomainError('bad_request', 'invalid_code', 'El código no es correcto o ya caducó. Pide uno nuevo.')
    const user = await this.findByEmail(email)
    if (!user || user.deleted_at) throw invalid
    const newHash = await hashPassword(password)
    const ok = await this.db.tx(async (tx) => {
      if (!(await this.consumeCode(user.id, 'reset_password', code, tx))) return false
      await tx.query(
        'UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1',
        [user.id, newHash],
      )
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
      await this.audit.record({ actorId: user.id, action: 'user.password_reset', entity: 'user', entityId: user.id }, tx)
      return true
    })
    if (!ok) throw invalid
    return user.id
  }

  /** Borra sesiones y códigos caducados: no hay motivo para conservarlos. */
  async purgeExpired(): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE expires_at < now()')
    await this.db.query(`DELETE FROM one_time_codes WHERE expires_at < now() - interval '1 day'`)
  }

  // ---------- Perfil ----------
  async getMe(userId: string): Promise<Me> {
    const [u] = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [userId])
    if (!u) throw notFound('La cuenta')
    return toMe(u)
  }

  async updateMe(userId: string, input: { fullName?: string; homeCountry?: string | null }): Promise<Me> {
    await this.db.query(
      `UPDATE users SET full_name = COALESCE($2, full_name),
         home_country = CASE WHEN $3::boolean THEN $4 ELSE home_country END, updated_at = now() WHERE id = $1`,
      [userId, input.fullName ?? null, input.homeCountry !== undefined, input.homeCountry ?? null],
    )
    return this.getMe(userId)
  }

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const [profile, bookings, reviews, reports, messages, checklist, mentor] = await Promise.all([
      this.getMe(userId),
      this.db.query('SELECT id, listing_id, status, start_date::text, end_date::text, message, created_at FROM bookings WHERE student_id = $1', [userId]),
      this.db.query('SELECT id, listing_id, rating, comment, stay_label, created_at FROM reviews WHERE author_id = $1', [userId]),
      this.db.query('SELECT id, listing_id, reason, detail, status, created_at FROM reports WHERE reporter_id = $1', [userId]),
      this.db.query('SELECT id, conversation_id, body, created_at FROM messages WHERE sender_id = $1', [userId]),
      this.db.query('SELECT task_id, done_at FROM checklist_progress WHERE user_id = $1', [userId]),
      this.db.query('SELECT kind, university, headline, bio, languages, topics, status FROM mentor_profiles WHERE user_id = $1', [userId]),
    ])
    return { exportedAt: new Date().toISOString(), profile, bookings, reviews, reports, messages, checklist, mentorProfile: mentor[0] ?? null }
  }

  /** Anonimiza: conserva reseñas y bitácora sin identificar a la persona. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const [user] = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [userId])
    if (!user) throw notFound('La cuenta')
    if (!(await argonVerify(user.password_hash, password))) {
      throw new DomainError('unauthorized', 'invalid_credentials', 'La contraseña no es correcta.')
    }
    await this.db.tx(async (tx) => {
      await tx.query(
        `UPDATE users SET email = $2, password_hash = '!', full_name = 'Cuenta eliminada', home_country = NULL,
           matricula = NULL, student_status = 'none', deleted_at = now(), updated_at = now() WHERE id = $1`,
        [userId, `deleted-${userId}@deleted.invalid`],
      )
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [userId])
      await tx.query('DELETE FROM mentor_profiles WHERE user_id = $1', [userId])
      await tx.query('DELETE FROM notifications WHERE user_id = $1', [userId])
      await tx.query(`UPDATE listings SET status = 'archived', exact_address = 'Eliminada' WHERE landlord_id = $1`, [userId])
      await tx.query(`UPDATE conversations SET status = 'closed' WHERE student_id = $1 OR counterpart_id = $1`, [userId])
      await tx.query(
        `UPDATE bookings SET status = 'cancelled', updated_at = now()
         WHERE student_id = $1 AND status IN ('requested','tour_scheduled','accepted')`,
        [userId],
      )
      await this.audit.record({ actorId: userId, action: 'user.deleted', entity: 'user', entityId: userId }, tx)
    })
  }

  // ---------- Validación de estudiante ----------
  async requestStudentVerification(actor: Actor, matricula: string): Promise<Me> {
    if (actor.role !== 'student') throw new DomainError('forbidden', 'not_student', 'Solo las cuentas de estudiante se validan.')
    const user = await this.getRow(actor.id)
    if (user.student_status === 'verified') return toMe(user)
    if (user.student_status === 'pending') {
      throw new DomainError('conflict', 'already_pending', 'Tu matrícula ya está en revisión.')
    }
    const [taken] = await this.db.query(
      `SELECT 1 FROM users WHERE matricula = $1 AND id <> $2 AND student_status <> 'rejected' LIMIT 1`,
      [matricula, actor.id],
    )
    if (taken) throw new DomainError('conflict', 'matricula_taken', 'Esa matrícula ya está asociada a otra cuenta. Si es tuya, contáctanos.')

    const method = validationMethodFor(user.email, user.email_verified_at !== null, this.opts.institutionalDomains)
    const auto = method === 'institutional_email'
    await this.db.tx(async (tx) => {
      await tx.query('UPDATE users SET matricula = $2, student_status = $3, updated_at = now() WHERE id = $1', [actor.id, matricula, auto ? 'verified' : 'pending'])
      await tx.query('INSERT INTO student_verifications (user_id, method, matricula, status) VALUES ($1,$2,$3,$4)', [
        actor.id,
        method,
        matricula,
        auto ? 'approved' : 'pending',
      ])
      await this.audit.record({ actorId: actor.id, action: 'student.verification_requested', entity: 'user', entityId: actor.id, meta: { method } }, tx)
    })
    return this.getMe(actor.id)
  }

  async listPendingStudents(): Promise<PendingStudent[]> {
    const rows = await this.db.query<{ id: string; full_name: string; email: string; matricula: string; home_country: string | null; requested_at: Date }>(
      `SELECT u.id, u.full_name, u.email, v.matricula, u.home_country, v.created_at AS requested_at
       FROM student_verifications v JOIN users u ON u.id = v.user_id
       WHERE v.status = 'pending' AND u.deleted_at IS NULL ORDER BY v.created_at`,
    )
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, matricula: r.matricula, homeCountry: r.home_country, requestedAt: r.requested_at.toISOString() }))
  }

  async decideStudent(admin: Actor, userId: string, approve: boolean, note?: string): Promise<void> {
    const done = await this.db.tx(async (tx) => {
      const rows = await tx.query(
        `UPDATE student_verifications SET status = $2, reviewed_by = $3, reviewed_at = now(), note = $4
         WHERE user_id = $1 AND status = 'pending' RETURNING id`,
        [userId, approve ? 'approved' : 'rejected', admin.id, note ?? null],
      )
      if (rows.length === 0) return false
      await tx.query(
        `UPDATE users SET student_status = $2, matricula = CASE WHEN $3::boolean THEN matricula ELSE NULL END WHERE id = $1`,
        [userId, approve ? 'verified' : 'rejected', approve],
      )
      await this.audit.record({ actorId: admin.id, action: approve ? 'student.approved' : 'student.rejected', entity: 'user', entityId: userId }, tx)
      return true
    })
    if (!done) throw notFound('La solicitud')
    await this.events.publish({ type: 'student.decided', userId, approved: approve })
  }

  private async findByEmail(email: string): Promise<UserRow | undefined> {
    const [u] = await this.db.query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email])
    return u
  }
  private async getRow(id: string): Promise<UserRow> {
    const [u] = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id])
    if (!u) throw notFound('La cuenta')
    return u
  }
}
