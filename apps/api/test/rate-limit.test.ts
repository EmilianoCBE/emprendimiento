import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type AppHandle } from '../src/composition.ts'
import { loadConfig } from '../src/config/env.ts'
import { createDb, migrate, type Db } from '../src/platform/db.ts'
import { seedBase } from '../src/seed/seed.ts'

let db: Db
let handle: AppHandle

beforeAll(async () => {
  db = createDb(null, { inMemory: true })
  await migrate(db)
  await seedBase(db)
  handle = await createApp(loadConfig({ NODE_ENV: 'test', APP_SECRET: 'x'.repeat(32) }), db, { logger: false, rateLimit: true })
}, 60_000)
afterAll(async () => {
  await handle.close()
  await db.close()
})

describe('límites de frecuencia', () => {
  it('frena intentos repetidos de inicio de sesión con una respuesta uniforme', async () => {
    const attempt = () =>
      handle.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'x-requested-with': 'aterriza' }, payload: { email: 'a@b.mx', password: 'incorrecta-1234' } })
    for (let i = 0; i < 30; i++) expect((await attempt()).statusCode).toBe(401)
    const blocked = await attempt()
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json().error.code).toBe('too_many_requests')
  }, 30_000)

  // Regresión: al contar archivos estáticos, la página dejaba de cargar tras unas cuantas visitas.
  it('nunca limita lo que no es API', async () => {
    for (let i = 0; i < 1100; i++) {
      const res = await handle.app.inject({ method: 'GET', url: '/assets/no-existe.js' })
      expect(res.statusCode).not.toBe(429)
    }
  }, 30_000)
})
