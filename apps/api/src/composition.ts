/** Raíz de composición: el único lugar que conoce las implementaciones concretas. */
import type { FastifyInstance } from 'fastify'
import type { AppConfig } from './config/env.ts'
import { API_PREFIX, buildServer } from './http/server.ts'
import { registerRoutes } from './http/routes.ts'
import { AdminReadService } from './modules/admin/service.ts'
import { BookingService } from './modules/bookings/service.ts'
import { CommunityService } from './modules/community/service.ts'
import { IdentityService } from './modules/identity/service.ts'
import { BelowMedianPolicy } from './modules/listings/domain.ts'
import { ListingRepository } from './modules/listings/repository.ts'
import { ListingService } from './modules/listings/service.ts'
import { NotificationService, SseHub } from './modules/notifications/service.ts'
import { PlanningService } from './modules/planning/service.ts'
import { DistinctReportersPolicy } from './modules/trust/domain.ts'
import { TrustService } from './modules/trust/service.ts'
import type { Db } from './platform/db.ts'
import { LocalFileStore } from './platform/files.ts'
import { ConsoleMailer, EventBus, type FileStore, type Mailer, SqlAuditLog } from './platform/kernel.ts'

export interface AppHandle {
  app: FastifyInstance
  hub: SseHub
  close(): Promise<void>
}

export function createMailer(config: AppConfig, log: (msg: string) => void): Mailer {
  if (config.isProduction) {
    throw new Error('Falta configurar un proveedor de correo: implementa el puerto Mailer antes de ir a producción (docs/08-seguridad.md).')
  }
  return new ConsoleMailer(log)
}

export async function createApp(
  config: AppConfig,
  db: Db,
  overrides: { logger?: boolean; rateLimit?: boolean; mailer?: Mailer; files?: FileStore } = {},
): Promise<AppHandle> {
  const logger = overrides.logger ?? true
  const audit = new SqlAuditLog(db)
  const hub = new SseHub()
  const bus = new EventBus((err) => console.error('Error en suscriptor de eventos', err))
  const mailer = overrides.mailer ?? createMailer(config, (m) => logger && console.info(m))
  const files = overrides.files ?? new LocalFileStore()

  const notifications = new NotificationService(db, hub)
  bus.subscribe(notifications.handle)

  const identity = new IdentityService(db, mailer, audit, bus, {
    appSecret: config.appSecret,
    institutionalDomains: config.institutionalDomains,
    demoMode: config.demoMode,
  })
  const planning = new PlanningService(db)
  const bookings = new BookingService(db, audit, bus)
  const trust = new TrustService(db, bookings, new DistinctReportersPolicy(3), audit, bus)
  const community = new CommunityService(db, audit, bus)
  const listings = new ListingService(db, new ListingRepository(db), new BelowMedianPolicy(0.2, 0.35), planning, files, audit, bus, {
    reviews: trust,
    mentors: community,
    bookings,
  })
  const admin = new AdminReadService(db)

  const app = await buildServer({
    config,
    logger,
    rateLimit: overrides.rateLimit,
    resolveSession: (token) => identity.resolveSession(token),
  })
  await app.register(
    async (scope) => registerRoutes(scope, { config, db, identity, listings, bookings, trust, community, planning, notifications, hub, admin }),
    { prefix: API_PREFIX },
  )

  const heartbeat = setInterval(() => hub.heartbeat(), 25_000)
  heartbeat.unref()
  void identity.purgeExpired().catch(() => {})
  const purge = setInterval(() => void identity.purgeExpired().catch(() => {}), 60 * 60_000)
  purge.unref()

  return {
    app,
    hub,
    async close() {
      clearInterval(heartbeat)
      clearInterval(purge)
      hub.disconnectAll()
      await app.close()
    },
  }
}
