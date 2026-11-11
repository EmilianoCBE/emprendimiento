import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type AppHandle } from '../src/composition.ts'
import { loadConfig } from '../src/config/env.ts'
import { createDb, migrate, type Db } from '../src/platform/db.ts'
import { seedBase, seedDemo } from '../src/seed/seed.ts'

const PASSWORD = 'clave-del-equipo-2026'
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
let db: Db
let handle: AppHandle

beforeAll(async () => {
  db = createDb(null, { inMemory: true })
  await migrate(db)
  await seedBase(db)
  await seedDemo(db)
  const config = loadConfig({ NODE_ENV: 'production', PUBLIC_DEMO: 'true', DEMO_GATE: 'on', DEMO_ACCESS_PASSWORD: PASSWORD, VERCEL_URL: 'demo.vercel.app' })
  handle = await createApp(config, db, { logger: false, rateLimit: false })
}, 60_000)
afterAll(async () => {
  await handle.close()
  await db.close()
})

describe('barrera de la demo pública (DEMO_GATE=on)', () => {
  const get = (authorization?: string) => handle.app.inject({ method: 'GET', url: '/api/v1/listings', headers: authorization ? { authorization } : {} })

  it('sin contraseña no entrega datos y pide credenciales', async () => {
    const res = await get()
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toContain('Basic')
    expect(res.body).not.toContain('Cuarto')
  })
  it('la contraseña de demo no se expone sin pasar la barrera', async () => {
    expect((await handle.app.inject({ method: 'GET', url: '/api/v1/config' })).body).not.toContain('Aterriza-Demo')
  })
  it('rechaza contraseña o usuario incorrectos', async () => {
    expect((await get(basic('equipo', 'incorrecta'))).statusCode).toBe(401)
    expect((await get(basic('otro', PASSWORD))).statusCode).toBe(401)
    expect((await get('Bearer abc')).statusCode).toBe(401)
  })
  it('con la contraseña correcta funciona', async () => {
    const res = await get(basic('equipo', PASSWORD))
    expect(res.statusCode).toBe(200)
    expect(res.json().total).toBeGreaterThan(5)
  })
  it('no acepta fotos nuevas y lo anuncia en la configuración', async () => {
    const auth = { authorization: basic('equipo', PASSWORD) }
    expect((await handle.app.inject({ method: 'GET', url: '/api/v1/config', headers: auth })).json().uploadsEnabled).toBe(false)
  })
  it('también protege mutaciones y fotos subidas', async () => {
    expect((await handle.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'x-requested-with': 'aterriza' }, payload: {} })).statusCode).toBe(401)
    expect((await handle.app.inject({ method: 'GET', url: '/uploads/x.png' })).statusCode).toBe(401)
  })
})
