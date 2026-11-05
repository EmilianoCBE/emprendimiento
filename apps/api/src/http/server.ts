import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance, type FastifyRequest, type preHandlerHookHandler } from 'fastify'
import { ZodError, type ZodType } from 'zod'
import type { ApiErrorBody, Role } from '@aterriza/contracts'
import type { AppConfig } from '../config/env.ts'
import { API_ROOT } from '../platform/db.ts'
import { UPLOADS_DIR } from '../platform/files.ts'
import { type Actor, DomainError } from '../platform/kernel.ts'
import { MAX_PHOTO_BYTES } from '../modules/listings/service.ts'

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null
  }
}

export const API_PREFIX = '/api/v1'
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const sessionCookieName = (config: AppConfig) => (config.isProduction ? '__Host-aterriza_session' : 'aterriza_session')

export const parse = <T>(schema: ZodType<T>, data: unknown): T => schema.parse(data)

// ---------- Decorators de autorización para rutas ----------
export function actorOf(req: FastifyRequest): Actor {
  if (!req.actor) throw new DomainError('unauthorized', 'auth_required', 'Inicia sesión para continuar.')
  return req.actor
}
export const requireAuth: preHandlerHookHandler = async (req) => {
  actorOf(req)
}
export const requireRole =
  (...roles: Role[]): preHandlerHookHandler =>
  async (req) => {
    if (!roles.includes(actorOf(req).role)) throw new DomainError('forbidden', 'forbidden', 'Tu cuenta no tiene permiso para esto.')
  }
export const requireValidatedStudent: preHandlerHookHandler = async (req) => {
  const actor = actorOf(req)
  if (actor.role !== 'student') throw new DomainError('forbidden', 'students_only', 'Esta acción es para cuentas de estudiante.')
  if (actor.studentStatus !== 'verified') throw new DomainError('forbidden', 'student_not_validated', 'Valida tu matrícula para continuar.')
}

/** Límites para rutas sensibles (ver docs/07-api.md). */
export const LIMITS = {
  auth: { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
  write: { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
  upload: { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
}

export interface ServerOptions {
  config: AppConfig
  resolveSession: (token: string | undefined) => Promise<Actor | null>
  logger?: boolean
  rateLimit?: boolean
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const { config } = opts
  const app = Fastify({
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024,
    logger: opts.logger
      ? {
          level: config.isProduction ? 'info' : 'warn',
          // Nada sensible debe llegar a los logs.
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        }
      : false,
  })

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  })
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  })

  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 } })
  if (opts.rateLimit !== false) {
    // Solo la API: limitar archivos estáticos impediría cargar la página. El límite es por IP y
    // un salón o un campus comparten IP; por eso es holgado y la defensa fina es por cuenta.
    await app.register(rateLimit, { global: true, max: 1000, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith(API_PREFIX) })
  }

  app.decorateRequest('actor', null)

  // Anti-CSRF: encabezado que un formulario externo no puede enviar + origen permitido.
  app.addHook('onRequest', async (req) => {
    if (!MUTATING.has(req.method) || !req.url.startsWith(API_PREFIX)) return
    const origin = req.headers.origin
    if (origin && !config.allowedOrigins.includes(origin)) {
      throw new DomainError('forbidden', 'bad_origin', 'Origen no permitido.')
    }
    if (req.headers['x-requested-with'] !== 'aterriza') {
      throw new DomainError('forbidden', 'csrf_header_missing', 'Solicitud no permitida.')
    }
  })

  app.addHook('preHandler', async (req) => {
    if (req.url.startsWith(API_PREFIX)) {
      req.actor = await opts.resolveSession(req.cookies[sessionCookieName(config)])
    }
  })

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    const body = (code: string, message: string, details?: string[]): ApiErrorBody => ({
      error: { code, message, ...(details ? { details } : {}), requestId: req.id },
    })
    if (err instanceof DomainError) return reply.status(err.status).send(body(err.code, err.message, err.details))
    if (err instanceof ZodError) {
      return reply.status(400).send(body('invalid_input', 'Revisa los datos.', err.issues.map((i) => i.message)))
    }
    const status = err.statusCode ?? 500
    if (status === 429) return reply.status(429).send(body('too_many_requests', 'Demasiados intentos. Espera un momento y vuelve a intentar.'))
    if (status === 413 || err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(413).send(body('too_large', 'El archivo es demasiado grande.'))
    if (status < 500) return reply.status(status).send(body('bad_request', 'La solicitud no es válida.'))
    // Nunca se envían detalles internos al cliente.
    req.log.error(err)
    return reply.status(500).send(body('internal_error', 'Algo falló de nuestro lado. Vuelve a intentar.'))
  })

  await app.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/', decorateReply: false, dotfiles: 'deny', index: false, list: false })

  const webDist = join(API_ROOT, '..', 'web', 'dist')
  const serveWeb = config.serveWeb && existsSync(join(webDist, 'index.html'))
  if (serveWeb) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false, index: 'index.html', dotfiles: 'deny' })
  }

  app.setNotFoundHandler((req, reply) => {
    if (serveWeb && req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
      return reply.sendFile('index.html')
    }
    const payload: ApiErrorBody = { error: { code: 'not_found', message: 'No encontramos esta ruta.', requestId: req.id } }
    return reply.status(404).send(payload)
  })

  return app
}
