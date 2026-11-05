/** Adaptador HTTP: traduce peticiones a casos de uso. Sin reglas de negocio ni SQL. */
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as c from '@aterriza/contracts'
import type { AppConfig } from '../config/env.ts'
import type { Queryable } from '../platform/db.ts'
import type { BookingService } from '../modules/bookings/service.ts'
import type { CommunityService } from '../modules/community/service.ts'
import type { IdentityService } from '../modules/identity/service.ts'
import type { ListingService } from '../modules/listings/service.ts'
import type { NotificationService, SseHub } from '../modules/notifications/service.ts'
import type { PlanningService } from '../modules/planning/service.ts'
import type { TrustService } from '../modules/trust/service.ts'
import type { AdminReadService } from '../modules/admin/service.ts'
import { DomainError } from '../platform/kernel.ts'
import { DEMO_PASSWORD } from '../seed/seed.ts'
import { LIMITS, actorOf, parse, requireAuth, requireRole, requireValidatedStudent, sessionCookieName } from './server.ts'

export interface RouteDeps {
  config: AppConfig
  db: Queryable
  identity: IdentityService
  listings: ListingService
  bookings: BookingService
  trust: TrustService
  community: CommunityService
  planning: PlanningService
  notifications: NotificationService
  hub: SseHub
  admin: AdminReadService
}

const idParam = z.object({ id: c.uuidSchema })
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export function registerRoutes(app: FastifyInstance, d: RouteDeps): void {
  const cookieName = sessionCookieName(d.config)
  const setSession = (reply: FastifyReply, token: string) =>
    reply.setCookie(cookieName, token, { httpOnly: true, secure: d.config.isProduction, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE })
  const clearSession = (reply: FastifyReply) => reply.clearCookie(cookieName, { path: '/', secure: d.config.isProduction, sameSite: 'lax', httpOnly: true })
  const admin = { preHandler: requireRole('admin') }
  const landlord = { preHandler: requireRole('landlord') }
  const auth = { preHandler: requireAuth }
  const student = { preHandler: requireValidatedStudent }

  // ---------- Sistema ----------
  app.get('/health', async (_req, reply) => {
    try {
      await d.db.query('SELECT 1')
      return { status: 'ok' }
    } catch {
      return reply.status(503).send({ status: 'degraded' })
    }
  })
  app.get('/config', async (): Promise<c.PublicConfig> => ({
    demoMode: d.config.demoMode,
    uploadsEnabled: d.config.uploadsEnabled,
    institutionalDomains: d.config.institutionalDomains,
    ...(d.config.demoMode ? { demoPassword: DEMO_PASSWORD } : {}),
  }))

  // ---------- Identidad ----------
  app.post('/auth/register', LIMITS.auth, async (req, reply) => {
    return reply.status(202).send(await d.identity.register(parse(c.registerSchema, req.body)))
  })
  app.post('/auth/verify-email', LIMITS.auth, async (req, reply) => {
    const { email, code } = parse(c.verifyEmailSchema, req.body)
    const { token, me } = await d.identity.verifyEmail(email, code)
    setSession(reply, token)
    return me
  })
  app.post('/auth/resend-code', LIMITS.auth, async (req) => d.identity.resendCode(parse(c.emailOnlySchema, req.body).email))
  app.post('/auth/login', LIMITS.auth, async (req, reply) => {
    const { email, password } = parse(c.loginSchema, req.body)
    const { token, me } = await d.identity.login(email, password)
    setSession(reply, token)
    return me
  })
  app.post('/auth/logout', async (req, reply) => {
    await d.identity.logout(req.cookies[cookieName])
    if (req.actor) d.hub.disconnect(req.actor.id)
    clearSession(reply)
    return { ok: true }
  })
  app.post('/auth/logout-all', auth, async (req, reply) => {
    await d.identity.logoutAll(actorOf(req).id)
    d.hub.disconnect(actorOf(req).id)
    clearSession(reply)
    return { ok: true }
  })
  app.post('/auth/forgot-password', LIMITS.auth, async (req) => d.identity.forgotPassword(parse(c.emailOnlySchema, req.body).email))
  app.post('/auth/reset-password', LIMITS.auth, async (req) => {
    const { email, code, password } = parse(c.resetPasswordSchema, req.body)
    d.hub.disconnect(await d.identity.resetPassword(email, code, password))
    return { ok: true }
  })
  app.get('/me', auth, async (req) => d.identity.getMe(actorOf(req).id))
  app.patch('/me', auth, async (req) => d.identity.updateMe(actorOf(req).id, parse(c.updateMeSchema, req.body)))
  app.get('/me/export', auth, async (req, reply) => {
    reply.header('Content-Disposition', 'attachment; filename="mis-datos-aterriza.json"')
    return d.identity.exportData(actorOf(req).id)
  })
  app.delete('/me', { ...auth, ...LIMITS.auth }, async (req, reply) => {
    await d.identity.deleteAccount(actorOf(req).id, parse(c.deleteMeSchema, req.body).password)
    d.hub.disconnect(actorOf(req).id)
    clearSession(reply)
    return { ok: true }
  })
  app.post('/me/student-verification', { ...auth, ...LIMITS.write }, async (req) =>
    d.identity.requestStudentVerification(actorOf(req), parse(c.studentVerificationSchema, req.body).matricula),
  )

  // ---------- Viviendas ----------
  app.get('/zones', async () => d.listings.zones())
  app.get('/listings', async (req) => d.listings.search(parse(c.listingQuerySchema, req.query)))
  app.get('/listings/:id', async (req) => d.listings.detail(parse(idParam, req.params).id, req.actor))
  app.get('/me/listings', landlord, async (req) => d.listings.mine(actorOf(req)))
  app.post('/listings', { ...landlord, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.listings.create(actorOf(req), parse(c.listingInputSchema, req.body))),
  )
  app.patch('/listings/:id', { ...landlord, ...LIMITS.write }, async (req) => {
    await d.listings.update(actorOf(req), parse(idParam, req.params).id, parse(c.listingInputSchema, req.body))
    return { ok: true }
  })
  app.post('/listings/:id/submit', { ...landlord, ...LIMITS.write }, async (req) => {
    await d.listings.submit(actorOf(req), parse(idParam, req.params).id)
    return { ok: true }
  })
  app.post('/listings/:id/archive', { ...landlord, ...LIMITS.write }, async (req) => {
    await d.listings.archive(actorOf(req), parse(idParam, req.params).id)
    return { ok: true }
  })
  app.post('/listings/:id/photos', { ...landlord, ...LIMITS.upload }, async (req, reply) => {
    const { id } = parse(idParam, req.params)
    if (!d.config.uploadsEnabled) throw new DomainError('forbidden', 'uploads_disabled', 'En la demo en línea no se suben fotos. Usa la versión local para probarlo.')
    const file = await req.file()
    if (!file) throw new DomainError('bad_request', 'photo_required', 'Elige una foto.')
    const alt = (file.fields.alt as { value?: string } | undefined)?.value ?? ''
    return reply.status(201).send(await d.listings.addPhoto(actorOf(req), id, await file.toBuffer(), alt))
  })
  app.delete('/listings/:id/photos/:photoId', landlord, async (req) => {
    const { id, photoId } = parse(z.object({ id: c.uuidSchema, photoId: c.uuidSchema }), req.params)
    await d.listings.deletePhoto(actorOf(req), id, photoId)
    return { ok: true }
  })

  // ---------- Solicitudes ----------
  // La autorización detallada la hacen las reglas, para devolver todas las razones de una vez.
  app.post('/bookings', { ...auth, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.bookings.request(actorOf(req), parse(c.createBookingSchema, req.body))),
  )
  app.get('/bookings', auth, async (req) => d.bookings.list(actorOf(req)))
  app.get('/bookings/:id', auth, async (req) => d.bookings.get(actorOf(req), parse(idParam, req.params).id))
  app.post('/bookings/:id/transitions', { ...auth, ...LIMITS.write }, async (req) =>
    d.bookings.transition(actorOf(req), parse(idParam, req.params).id, parse(c.bookingTransitionSchema, req.body)),
  )

  app.put('/bookings/:id/steps/:step', { ...auth, ...LIMITS.write }, async (req) => {
    const { id, step } = parse(z.object({ id: c.uuidSchema, step: z.string().max(40) }), req.params)
    await d.bookings.setStep(actorOf(req), id, step, parse(c.bookingStepSchema, req.body).done)
    return { ok: true }
  })

  // ---------- Confianza ----------
  app.post('/listings/:id/reviews', { ...student, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.trust.submitReview(actorOf(req), parse(idParam, req.params).id, parse(c.reviewSchema, req.body))),
  )
  app.post('/listings/:id/reports', { ...auth, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.trust.report(actorOf(req), parse(idParam, req.params).id, parse(c.reportSchema, req.body))),
  )

  // ---------- Comunidad ----------
  app.get('/mentors', async (req) => d.community.searchMentors(parse(c.mentorQuerySchema, req.query)))
  app.get('/mentors/:id', async (req) => d.community.getMentor(parse(idParam, req.params).id))
  app.get('/me/mentor-profile', { preHandler: requireRole('mentor') }, async (req) => d.community.getOwnProfile(actorOf(req)))
  app.put('/me/mentor-profile', { preHandler: requireRole('mentor'), ...LIMITS.write }, async (req) => {
    await d.community.upsertProfile(actorOf(req), parse(c.mentorProfileSchema, req.body))
    return { ok: true }
  })
  app.post('/mentors/:id/connect', { ...student, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.community.connect(actorOf(req), parse(idParam, req.params).id, parse(c.connectSchema, req.body).intro)),
  )
  app.get('/conversations', auth, async (req) => d.community.listConversations(actorOf(req)))
  app.get('/conversations/:id', auth, async (req) => d.community.getConversation(actorOf(req), parse(idParam, req.params).id))
  app.get('/conversations/:id/messages', auth, async (req) => {
    const { before } = parse(z.object({ before: z.string().datetime({ offset: true }).optional() }), req.query)
    return d.community.messages(actorOf(req), parse(idParam, req.params).id, before)
  })
  app.post('/conversations/:id/messages', { ...auth, ...LIMITS.write }, async (req, reply) =>
    reply.status(201).send(await d.community.send(actorOf(req), parse(idParam, req.params).id, parse(c.messageSchema, req.body).body)),
  )
  app.post('/conversations/:id/respond', { ...auth, ...LIMITS.write }, async (req) => {
    await d.community.respond(actorOf(req), parse(idParam, req.params).id, parse(c.respondSchema, req.body).accept)
    return { ok: true }
  })

  app.get('/events', auth, (req, reply) => {
    const res = reply.raw
    reply.hijack()
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no',
    })
    res.write(': conectado\n\n')
    d.hub.add(actorOf(req).id, res)
  })

  // ---------- Planeación ----------
  app.post('/budget/estimate', LIMITS.write, async (req) => d.planning.estimate(parse(c.budgetSchema, req.body)))
  app.get('/guides', async () => d.planning.listGuides())
  app.get('/guides/:slug', async (req) => d.planning.getGuide(parse(z.object({ slug: z.string().max(80) }), req.params).slug))
  app.get('/checklist', auth, async (req) => d.planning.getChecklist(actorOf(req).id))
  app.put('/checklist/:taskId', auth, async (req) => {
    const { taskId } = parse(z.object({ taskId: z.string().max(40) }), req.params)
    await d.planning.setChecklist(actorOf(req).id, taskId, parse(c.checklistSchema, req.body).done)
    return { ok: true }
  })

  // ---------- Notificaciones ----------
  app.get('/notifications', auth, async (req) => d.notifications.list(actorOf(req).id))
  app.post('/notifications/read-all', auth, async (req) => {
    await d.notifications.readAll(actorOf(req).id)
    return { ok: true }
  })

  // ---------- Administración ----------
  app.get('/admin/metrics', admin, async () => d.admin.metrics())
  app.get('/admin/listings/queue', admin, async () => d.listings.reviewQueue())
  app.put('/admin/listings/:id/criteria', admin, async (req) => {
    await d.listings.setCriteria(actorOf(req), parse(idParam, req.params).id, parse(c.criteriaUpdateSchema, req.body).criteria)
    return { ok: true }
  })
  app.post('/admin/listings/:id/decision', admin, async (req) => {
    const { decision, note } = parse(c.listingDecisionSchema, req.body)
    await d.listings.decide(actorOf(req), parse(idParam, req.params).id, decision, note)
    return { ok: true }
  })
  app.get('/admin/reports', admin, async () => d.trust.openReports())
  app.post('/admin/reports/:id/resolve', admin, async (req) => {
    await d.trust.resolve(actorOf(req), parse(idParam, req.params).id, parse(c.reportResolutionSchema, req.body).decision)
    return { ok: true }
  })
  app.get('/admin/students/pending', admin, async () => d.identity.listPendingStudents())
  app.post('/admin/students/:id/decision', admin, async (req) => {
    const { approve, note } = parse(c.approvalSchema, req.body)
    await d.identity.decideStudent(actorOf(req), parse(idParam, req.params).id, approve, note)
    return { ok: true }
  })
  app.get('/admin/mentors/pending', admin, async () => d.community.pendingMentors())
  app.post('/admin/mentors/:id/decision', admin, async (req) => {
    await d.community.decideMentor(actorOf(req), parse(idParam, req.params).id, parse(c.approvalSchema, req.body).approve)
    return { ok: true }
  })
  app.get('/admin/audit', admin, async (req) => {
    const { page } = parse(z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }), req.query)
    return d.admin.audit(page)
  })
}
