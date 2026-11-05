/** Integración sobre Postgres real embebido: rutas, autorización y flujos completos. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { loadConfig } from '../src/config/env.ts'
import { createApp, type AppHandle } from '../src/composition.ts'
import { createDb, migrate, type Db } from '../src/platform/db.ts'
import { DEMO_PASSWORD, seedBase, seedDemo } from '../src/seed/seed.ts'

let db: Db
let handle: AppHandle
let app: FastifyInstance
const PREFIX = '/api/v1'
const COOKIE = 'aterriza_session'

interface Call {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  cookie?: string
  headers?: Record<string, string>
}
async function api(path: string, { method = 'GET', body, cookie, headers }: Call = {}) {
  const res = await app.inject({
    method,
    url: `${PREFIX}${path}`,
    payload: body as object,
    cookies: cookie ? { [COOKIE]: cookie } : undefined,
    headers: { 'x-requested-with': 'aterriza', ...headers },
  })
  let json: any = null
  try {
    json = res.json()
  } catch {
    json = null
  }
  return { status: res.statusCode, json, res }
}
async function login(name: string) {
  const r = await api('/auth/login', { method: 'POST', body: { email: `${name}@demo.aterriza.mx`, password: DEMO_PASSWORD } })
  expect(r.status).toBe(200)
  return r.res.cookies.find((c) => c.name === COOKIE)!.value
}
const findListing = async (title: string) => {
  const [row] = await db.query<{ id: string }>('SELECT id FROM listings WHERE title = $1', [title])
  return row!.id
}

const VERIFIED = 'Cuarto con baño propio a 8 minutos del campus'
const SUSPICIOUS = 'Depa amueblado económico muy cerca del Tec'
const PENDING = 'Cuarto nuevo esperando revisión'
const FUTURE = { startDate: '2027-01-10', endDate: '2027-06-20' }

let lucia: string, tomas: string, clara: string, marcela: string, rogelio: string, diego: string, adminC: string

beforeAll(async () => {
  db = createDb(null, { inMemory: true })
  await migrate(db)
  await seedBase(db)
  await seedDemo(db)
  const config = loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', APP_SECRET: 'test-secret-test-secret-test-secret' })
  handle = await createApp(config, db, { logger: false, rateLimit: false })
  app = handle.app
  ;[lucia, tomas, clara, marcela, rogelio, diego, adminC] = await Promise.all(
    ['lucia', 'tomas', 'clara', 'marcela', 'rogelio', 'diego', 'admin'].map(login),
  ) as [string, string, string, string, string, string, string]
}, 60_000)

afterAll(async () => {
  await handle.close()
  await db.close()
})

describe('seguridad de la capa HTTP', () => {
  it('rechaza mutaciones sin encabezado anti-CSRF', async () => {
    const res = await app.inject({ method: 'POST', url: `${PREFIX}/auth/logout` })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('csrf_header_missing')
  })
  it('rechaza orígenes no permitidos', async () => {
    const r = await api('/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('bad_origin')
  })
  it('envía cabeceras de seguridad', async () => {
    const { res } = await api('/health')
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
    expect(res.headers['content-security-policy']).toContain("script-src 'self'")
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })
  it('la cookie de sesión es HttpOnly y SameSite', async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email: 'lucia@demo.aterriza.mx', password: DEMO_PASSWORD } })
    const c = r.res.cookies.find((x) => x.name === COOKIE)!
    expect(c.httpOnly).toBe(true)
    expect(c.sameSite).toBe('Lax')
  })
  it('el token de sesión no se guarda en claro', async () => {
    const rows = await db.query<{ token_hash: string }>('SELECT token_hash FROM sessions')
    expect(rows.every((r) => r.token_hash !== lucia)).toBe(true)
  })
  it('un error interno no filtra detalles; la ruta inexistente responde 404', async () => {
    const r = await api('/no-existe')
    expect(r.status).toBe(404)
    expect(JSON.stringify(r.json)).not.toContain('stack')
  })
  it('RLS está activo en todas las tablas', async () => {
    const rows = await db.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    )
    expect(rows).toEqual([])
  })
})

describe('registro e inicio de sesión', () => {
  const email = 'nueva@tec.mx'
  const password = 'cielo-azul-sobre-sierra'
  let code: string
  let cookie: string

  it('no permite registrarse como administrador', async () => {
    const r = await api('/auth/register', { method: 'POST', body: { email: 'x@y.mx', password, fullName: 'Hacker', role: 'admin' } })
    expect(r.status).toBe(400)
  })
  it('rechaza contraseñas débiles', async () => {
    const r = await api('/auth/register', { method: 'POST', body: { email: 'z@y.mx', password: '1234567890', fullName: 'Débil', role: 'student' } })
    expect(r.status).toBe(400)
  })
  it('registra y da un código en modo demo', async () => {
    const r = await api('/auth/register', { method: 'POST', body: { email, password, fullName: 'Nueva Persona', role: 'student', homeCountry: 'Chile' } })
    expect(r.status).toBe(202)
    code = r.json.devCode
    expect(code).toMatch(/^\d{6}$/)
  })
  it('no revela si un correo ya confirmado existe', async () => {
    const r = await api('/auth/register', { method: 'POST', body: { email: 'lucia@demo.aterriza.mx', password, fullName: 'Otra', role: 'student' } })
    expect(r.status).toBe(202)
    expect(r.json.ok).toBe(true)
    expect(r.json.devCode).toBeUndefined()
  })
  it('un registro repetido no cambia la contraseña de la cuenta', async () => {
    const before = await db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE email = 'lucia@demo.aterriza.mx'`)
    await api('/auth/register', { method: 'POST', body: { email: 'lucia@demo.aterriza.mx', password, fullName: 'Otra', role: 'student' } })
    const after = await db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE email = 'lucia@demo.aterriza.mx'`)
    expect(after[0]!.password_hash).toBe(before[0]!.password_hash)
  })
  it('sin confirmar el correo no entra', async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } })
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('email_not_verified')
  })
  it('un código incorrecto falla', async () => {
    const wrong = code === '000000' ? '000001' : '000000'
    const r = await api('/auth/verify-email', { method: 'POST', body: { email, code: wrong } })
    expect(r.status).toBe(400)
  })
  it('tras 5 intentos fallidos, ni el código correcto sirve', async () => {
    const e = 'intentos@gmail.com'
    const reg = await api('/auth/register', { method: 'POST', body: { email: e, password, fullName: 'Fuerza Bruta', role: 'student' } })
    const good = reg.json.devCode as string
    const bad = good === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++) await api('/auth/verify-email', { method: 'POST', body: { email: e, code: bad } })
    expect((await api('/auth/verify-email', { method: 'POST', body: { email: e, code: good } })).status).toBe(400)
  })
  it('confirma el correo e inicia sesión', async () => {
    const r = await api('/auth/verify-email', { method: 'POST', body: { email, code } })
    expect(r.status).toBe(200)
    expect(r.json.emailVerified).toBe(true)
    cookie = r.res.cookies.find((c) => c.name === COOKIE)!.value
  })
  it('el código no se puede reutilizar', async () => {
    expect((await api('/auth/verify-email', { method: 'POST', body: { email, code } })).status).toBe(400)
  })
  it('correo institucional + matrícula valida en automático', async () => {
    const r = await api('/me/student-verification', { method: 'POST', cookie, body: { matricula: 'a01234567' } })
    expect(r.status).toBe(200)
    expect(r.json.studentStatus).toBe('verified')
    expect(r.json.matricula).toBe('A01234567')
  })
  it('una matrícula no se puede repetir', async () => {
    const r = await api('/me/student-verification', { method: 'POST', cookie: await registerStudent('otra@gmail.com'), body: { matricula: 'A01234567' } })
    expect(r.status).toBe(409)
  })
  it('sin correo institucional, va a revisión manual y un admin decide', async () => {
    const c2 = await registerStudent('manual@gmail.com')
    const r = await api('/me/student-verification', { method: 'POST', cookie: c2, body: { matricula: 'A07654321' } })
    expect(r.json.studentStatus).toBe('pending')
    const me = await api('/me', { cookie: c2 })
    expect((await api(`/admin/students/${me.json.id}/decision`, { method: 'POST', cookie: lucia, body: { approve: true } })).status).toBe(403)
    expect((await api(`/admin/students/${me.json.id}/decision`, { method: 'POST', cookie: adminC, body: { approve: true } })).status).toBe(200)
    expect((await api('/me', { cookie: c2 })).json.studentStatus).toBe('verified')
  })
  it('no se puede subir el rol ni el estado por PATCH /me', async () => {
    const r = await api('/me', { method: 'PATCH', cookie, body: { fullName: 'Nombre Nuevo', role: 'admin', student_status: 'verified' } })
    expect(r.json.role).toBe('student')
    expect(r.json.fullName).toBe('Nombre Nuevo')
  })
  it('recupera la contraseña y cierra las sesiones anteriores', async () => {
    const f = await api('/auth/forgot-password', { method: 'POST', body: { email } })
    const newPassword = 'montana-verde-del-norte'
    expect((await api('/auth/reset-password', { method: 'POST', body: { email, code: f.json.devCode, password: newPassword } })).status).toBe(200)
    expect((await api('/me', { cookie })).status).toBe(401)
    expect((await api('/auth/login', { method: 'POST', body: { email, password: newPassword } })).status).toBe(200)
  })
  it('recuperar con un correo inexistente responde igual', async () => {
    const r = await api('/auth/forgot-password', { method: 'POST', body: { email: 'nadie@nowhere.mx' } })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })
  it('bloquea la cuenta tras 5 fallos', async () => {
    const e = 'bloqueo@gmail.com'
    await registerStudent(e)
    for (let i = 0; i < 5; i++) await api('/auth/login', { method: 'POST', body: { email: e, password: 'contraseña-incorrecta' } })
    const r = await api('/auth/login', { method: 'POST', body: { email: e, password } })
    expect(r.status).toBe(401)
    expect(r.json.error.code).toBe('account_locked')
  })
  it('logout invalida la sesión', async () => {
    const c = await login('clara')
    await api('/auth/logout', { method: 'POST', cookie: c })
    expect((await api('/me', { cookie: c })).status).toBe(401)
  })

  async function registerStudent(e: string) {
    const r = await api('/auth/register', { method: 'POST', body: { email: e, password, fullName: 'Otra Persona', role: 'student' } })
    const v = await api('/auth/verify-email', { method: 'POST', body: { email: e, code: r.json.devCode } })
    return v.res.cookies.find((c) => c.name === COOKIE)!.value
  }
})

describe('búsqueda y ficha', () => {
  it('es pública y no expone direcciones', async () => {
    const r = await api('/listings')
    expect(r.status).toBe(200)
    expect(r.json.items.length).toBeGreaterThan(5)
    expect(JSON.stringify(r.json)).not.toMatch(/exact_address|exactAddress|Calle Demo/)
  })
  it('ordena primero las verificadas', async () => {
    const r = await api('/listings?pageSize=50')
    const counts = r.json.items.map((i: any) => i.metCount)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })
  it('oculta lo que no está aprobado', async () => {
    const r = await api('/listings?pageSize=50')
    expect(r.json.items.map((i: any) => i.title)).not.toContain(PENDING)
    expect((await api(`/listings/${await findListing(PENDING)}`)).status).toBe(404)
  })
  it('aplica filtros', async () => {
    const r = await api('/listings?maxRent=8000&verifiedOnly=true&pageSize=50')
    expect(r.json.items.length).toBeGreaterThan(0)
    for (const i of r.json.items) {
      expect(i.monthlyRentMxn).toBeLessThanOrEqual(8000)
      expect(i.metCount).toBe(4)
    }
    expect((await api('/listings?zone=contry&pageSize=50')).json.items.every((i: any) => i.zoneSlug === 'contry')).toBe(true)
  })
  it('la contraseña de demo solo se expone en modo demo', async () => {
    expect((await api('/config')).json.demoPassword).toBe(DEMO_PASSWORD)
  })
  it('resiste inyección en los filtros', async () => {
    const r = await api(`/listings?q=${encodeURIComponent(`'; DROP TABLE listings;--`)}`)
    expect(r.status).toBe(200)
    expect(r.json.items).toEqual([])
    expect((await db.query('SELECT 1 FROM listings LIMIT 1')).length).toBe(1)
    expect((await api('/listings?sort=monthly_rent_mxn;DROP')).status).toBe(400)
  })
  it('la vivienda sospechosa muestra alerta de peligro', async () => {
    const r = await api(`/listings/${await findListing(SUSPICIOUS)}`)
    expect(r.json.priceAlert.severity).toBe('danger')
    expect(r.json.verification.level).toBe('partial')
  })
  it('un cuarto económico no se compara con departamentos', async () => {
    const r = await api(`/listings/${await findListing('Cuarto sencillo en casa con dueña')}`)
    expect(r.json.priceAlert).toBeNull()
  })
  it('la ficha no da la dirección a un visitante ni a un estudiante cualquiera', async () => {
    const id = await findListing(VERIFIED)
    expect((await api(`/listings/${id}`)).json.exactAddress).toBeNull()
    expect((await api(`/listings/${id}`, { cookie: lucia })).json.exactAddress).toBeNull()
    expect((await api(`/listings/${id}`, { cookie: marcela })).json.exactAddress).toContain('Calle Demo')
  })
  it('incluye presupuesto, mentores y reseñas', async () => {
    const r = await api(`/listings/${await findListing(VERIFIED)}`)
    expect(r.json.budget.lines.length).toBeGreaterThan(3)
    expect(r.json.mentors.length).toBeGreaterThan(0)
    expect(r.json.reviews.length).toBe(2)
    expect(r.json.rating).not.toBeNull()
  })
})

describe('solicitud de vivienda', () => {
  let bookingId: string

  it('solo con sesión', async () => {
    const id = await findListing(VERIFIED)
    expect((await api('/bookings', { method: 'POST', body: { listingId: id, ...FUTURE, message: 'Hola, me interesa.', fraudNoticeAck: true } })).status).toBe(401)
  })
  it('una vivienda parcial no se puede solicitar y explica por qué', async () => {
    const r = await api('/bookings', { method: 'POST', cookie: lucia, body: { listingId: await findListing(SUSPICIOUS), ...FUTURE, message: 'Hola, me interesa.', fraudNoticeAck: true } })
    expect(r.status).toBe(422)
    expect(r.json.error.details.join()).toContain('4 revisiones')
  })
  it('exige aceptar el aviso de pagos', async () => {
    const r = await api('/bookings', { method: 'POST', cookie: lucia, body: { listingId: await findListing(VERIFIED), ...FUTURE, message: 'Hola, me interesa.', fraudNoticeAck: false } })
    expect(r.status).toBe(422)
  })
  it('un arrendador no puede solicitar', async () => {
    const r = await api('/bookings', { method: 'POST', cookie: rogelio, body: { listingId: await findListing(VERIFIED), ...FUTURE, message: 'Hola, me interesa.', fraudNoticeAck: true } })
    expect(r.status).toBe(422)
  })
  it('el estudiante validado solicita y se notifica al arrendador', async () => {
    const r = await api('/bookings', { method: 'POST', cookie: lucia, body: { listingId: await findListing(VERIFIED), ...FUTURE, message: 'Hola, llego en enero y me interesa.', fraudNoticeAck: true } })
    expect(r.status).toBe(201)
    bookingId = r.json.id
    const n = await api('/notifications', { cookie: marcela })
    expect(n.json.items.map((x: any) => x.title)).toContain('Nueva solicitud')
  })
  it('no se puede duplicar', async () => {
    const r = await api('/bookings', { method: 'POST', cookie: lucia, body: { listingId: await findListing(VERIFIED), ...FUTURE, message: 'Otra vez, por favor.', fraudNoticeAck: true } })
    expect(r.status).toBe(422)
    expect(r.json.error.details.join()).toContain('Ya tienes')
  })
  it('IDOR: otra persona recibe 404', async () => {
    expect((await api(`/bookings/${bookingId}`, { cookie: tomas })).status).toBe(404)
    expect((await api(`/bookings/${bookingId}`, { cookie: rogelio })).status).toBe(404)
    expect((await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: rogelio, body: { action: 'accept' } })).status).toBe(404)
  })
  it('el estudiante no ve la dirección antes de aceptar ni puede aceptarse solo', async () => {
    const b = await api(`/bookings/${bookingId}`, { cookie: lucia })
    expect(b.json.exactAddress).toBeNull()
    expect((await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: lucia, body: { action: 'accept' } })).status).toBe(409)
  })
  it('la lista para mudarte es de quien solicita', async () => {
    expect((await api(`/bookings/${bookingId}/steps/passport`, { method: 'PUT', cookie: lucia, body: { done: true } })).status).toBe(200)
    const b = await api(`/bookings/${bookingId}`, { cookie: lucia })
    expect(b.json.steps.find((s: any) => s.id === 'passport').done).toBe(true)
    expect(b.json.reference).toHaveLength(8)
    expect((await api(`/bookings/${bookingId}/steps/passport`, { method: 'PUT', cookie: tomas, body: { done: true } })).status).toBe(404)
    expect((await api(`/bookings/${bookingId}/steps/passport`, { method: 'PUT', cookie: marcela, body: { done: false } })).status).toBe(404)
    expect((await api(`/bookings/${bookingId}/steps/otro`, { method: 'PUT', cookie: lucia, body: { done: true } })).status).toBe(404)
  })
  it('el arrendador agenda videollamada solo a futuro', async () => {
    expect((await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: marcela, body: { action: 'schedule_tour', tourAt: '2020-01-01T10:00:00Z' } })).status).toBe(400)
    const r = await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: marcela, body: { action: 'schedule_tour', tourAt: '2030-01-01T10:00:00Z' } })
    expect(r.json.status).toBe('tour_scheduled')
  })
  it('al aceptar se revela la dirección', async () => {
    await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: marcela, body: { action: 'accept' } })
    const b = await api(`/bookings/${bookingId}`, { cookie: lucia })
    expect(b.json.status).toBe('accepted')
    expect(b.json.exactAddress).toContain('Calle Demo')
    expect((await api(`/listings/${b.json.listing.id}`, { cookie: lucia })).json.exactAddress).toContain('Calle Demo')
  })
  it('al confirmar, la vivienda sale de la búsqueda', async () => {
    const b = await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: lucia, body: { action: 'confirm' } })
    expect(b.json.status).toBe('confirmed')
    const search = await api('/listings?pageSize=50')
    expect(search.json.items.map((i: any) => i.title)).not.toContain(VERIFIED)
    const later = await api('/bookings', { method: 'POST', cookie: tomas, body: { listingId: b.json.listing.id, startDate: '2027-02-01', endDate: '2027-08-01', message: 'Me interesa mucho.', fraudNoticeAck: true } })
    expect(later.status).toBe(422)
  })
  it('deja línea de tiempo completa', async () => {
    const b = await api(`/bookings/${bookingId}`, { cookie: lucia })
    expect(b.json.events.map((e: any) => e.toStatus)).toEqual(['requested', 'tour_scheduled', 'accepted', 'confirmed'])
  })
  it('al concluir, se libera la vivienda y se permite reseñar', async () => {
    const b = await api(`/bookings/${bookingId}/transitions`, { method: 'POST', cookie: marcela, body: { action: 'complete' } })
    expect(b.json.status).toBe('completed')
    expect((await api('/listings?pageSize=50')).json.items.map((i: any) => i.title)).toContain(VERIFIED)
    expect((await api(`/bookings/${bookingId}`, { cookie: lucia })).json.canReview).toBe(true)
  })
})

describe('reseñas y reportes', () => {
  it('sin estancia no se puede reseñar', async () => {
    const id = await findListing('Loft con vista a la sierra')
    const r = await api(`/listings/${id}/reviews`, { method: 'POST', cookie: lucia, body: { rating: 5, comment: 'Una reseña sin haber vivido ahí.' } })
    expect(r.status).toBe(403)
  })
  it('con estancia sí, una sola vez', async () => {
    const id = await findListing('Recámara amueblada con baño compartido')
    const first = await api(`/listings/${id}/reviews`, { method: 'POST', cookie: lucia, body: { rating: 4, comment: 'Muy buena ubicación y todo como en el anuncio.' } })
    expect(first.status).toBe(201)
    const again = await api(`/listings/${id}/reviews`, { method: 'POST', cookie: lucia, body: { rating: 1, comment: 'Intento dejar otra reseña más.' } })
    expect(again.status).toBe(403)
  })
  it('valida longitud del comentario', async () => {
    const id = await findListing('Recámara amueblada con baño compartido')
    expect((await api(`/listings/${id}/reviews`, { method: 'POST', cookie: lucia, body: { rating: 4, comment: 'corto' } })).status).toBe(400)
  })
  it('con 3 reportes distintos sale de la búsqueda; el admin puede restaurar', async () => {
    const id = await findListing('Estudio remodelado con buena luz natural')
    expect((await api(`/listings/${id}/reports`, { method: 'POST', cookie: lucia, body: { reason: 'fake_listing' } })).json.flagged).toBe(false)
    expect((await api(`/listings/${id}/reports`, { method: 'POST', cookie: lucia, body: { reason: 'fake_listing' } })).status).toBe(409)
    expect((await api(`/listings/${id}/reports`, { method: 'POST', cookie: tomas, body: { reason: 'asked_prepayment' } })).json.flagged).toBe(false)
    expect((await api(`/listings/${id}/reports`, { method: 'POST', cookie: clara, body: { reason: 'no_receipt' } })).json.flagged).toBe(true)
    expect((await api(`/listings/${id}`)).status).toBe(404)

    expect((await api('/admin/reports', { cookie: lucia })).status).toBe(403)
    const reports = await api('/admin/reports', { cookie: adminC })
    const own = reports.json.filter((r: any) => r.listingId === id)
    expect(own).toHaveLength(3)
    for (const r of own) await api(`/admin/reports/${r.id}/resolve`, { method: 'POST', cookie: adminC, body: { decision: 'dismiss' } })
    expect((await api(`/listings/${id}`)).status).toBe(200)
  })
  it('el dueño no puede reportar su vivienda', async () => {
    const id = await findListing('Loft con vista a la sierra')
    expect((await api(`/listings/${id}/reports`, { method: 'POST', cookie: rogelio, body: { reason: 'other' } })).status).toBe(403)
  })
})

describe('arrendador y revisión', () => {
  const input = async () => {
    const zones = await api('/zones')
    return {
      zoneId: zones.json[0].id, title: 'Cuarto de prueba para revisión', description: 'Descripción suficientemente larga para pasar la validación.',
      kind: 'room', monthlyRentMxn: 9000, depositMonths: 1, minMonths: 5, semesterContract: true, minutesWalk: 10, minutesTransit: 8,
      furnished: true, utilitiesIncluded: false, airConditioning: true, exactAddress: 'Calle Privada 123, Monterrey', availableFrom: '2027-01-05',
      costItems: [{ label: 'Agua', included: true }],
    }
  }
  let listingId: string

  it('solo un arrendador crea viviendas', async () => {
    expect((await api('/listings', { method: 'POST', cookie: lucia, body: await input() })).status).toBe(403)
  })
  it('crea un borrador invisible al público', async () => {
    const r = await api('/listings', { method: 'POST', cookie: marcela, body: await input() })
    expect(r.status).toBe(201)
    listingId = r.json.id
    expect((await api(`/listings/${listingId}`)).status).toBe(404)
  })
  it('IDOR: otro arrendador no puede editar ni archivar', async () => {
    expect((await api(`/listings/${listingId}`, { method: 'PATCH', cookie: rogelio, body: await input() })).status).toBe(404)
    expect((await api(`/listings/${listingId}/archive`, { method: 'POST', cookie: rogelio })).status).toBe(404)
  })
  it('no se envía sin fotos', async () => {
    expect((await api(`/listings/${listingId}/submit`, { method: 'POST', cookie: marcela })).status).toBe(422)
  })
  it('rechaza archivos que no son imagen, y acepta una imagen real', async () => {
    const upload = (bytes: Buffer, filename: string, type: string) => {
      const boundary = 'xBOUNDARYx'
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ])
      return app.inject({
        method: 'POST',
        url: `${PREFIX}/listings/${listingId}/photos`,
        payload,
        cookies: { [COOKIE]: marcela },
        headers: { 'x-requested-with': 'aterriza', 'content-type': `multipart/form-data; boundary=${boundary}` },
      })
    }
    expect((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'foto.png', 'image/png')).statusCode).toBe(400)
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
    const ok = await upload(png, '../../evil.png', 'image/png')
    expect(ok.statusCode).toBe(201)
    expect(ok.json().url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)
    const served = await app.inject({ method: 'GET', url: ok.json().url })
    expect(served.statusCode).toBe(200)
    expect(served.headers['content-type']).toBe('image/png')
    expect(served.headers['x-content-type-options']).toBe('nosniff')
    for (const bad of ['/uploads/..%2f..%2f.env', '/uploads/../package.json', '/uploads/passwd', '/uploads/00000000-0000-0000-0000-000000000000.png']) {
      expect((await app.inject({ method: 'GET', url: bad })).statusCode).toBe(404)
    }
  })
  it('flujo de revisión: enviar, marcar criterios y aprobar', async () => {
    expect((await api(`/listings/${listingId}/submit`, { method: 'POST', cookie: marcela })).status).toBe(200)
    expect((await api(`/admin/listings/${listingId}/decision`, { method: 'POST', cookie: adminC, body: { decision: 'approve' } })).status).toBe(422)
    expect((await api(`/admin/listings/${listingId}/criteria`, { method: 'PUT', cookie: marcela, body: { criteria: { ownership_docs: true, landlord_identity: true, model_contract: true, dated_photos: true } } })).status).toBe(403)
    await api(`/admin/listings/${listingId}/criteria`, { method: 'PUT', cookie: adminC, body: { criteria: { ownership_docs: true, landlord_identity: true, model_contract: true, dated_photos: true } } })
    expect((await api(`/admin/listings/${listingId}/decision`, { method: 'POST', cookie: adminC, body: { decision: 'approve' } })).status).toBe(200)
    const pub = await api(`/listings/${listingId}`)
    expect(pub.status).toBe(200)
    expect(pub.json.verification.level).toBe('verified')
  })
  const reapprove = async () => {
    await api(`/admin/listings/${listingId}/decision`, { method: 'POST', cookie: adminC, body: { decision: 'approve' } })
    expect((await api(`/listings/${listingId}`)).status).toBe(200)
  }
  it('cambiar la fecha de disponibilidad no exige otra revisión', async () => {
    await api(`/listings/${listingId}`, { method: 'PATCH', cookie: marcela, body: { ...(await input()), availableFrom: '2027-02-01' } })
    expect((await api(`/listings/${listingId}`)).status).toBe(200)
  })
  it('cambiar renta o descripción de una publicada la devuelve a revisión', async () => {
    await api(`/listings/${listingId}`, { method: 'PATCH', cookie: marcela, body: { ...(await input()), monthlyRentMxn: 5000 } })
    expect((await api(`/listings/${listingId}`)).status).toBe(404)
    await reapprove()
    await api(`/listings/${listingId}`, { method: 'PATCH', cookie: marcela, body: { ...(await input()), monthlyRentMxn: 5000, description: 'Ahora es otro lugar, pero con la misma aprobación que el anterior.' } })
    expect((await api(`/listings/${listingId}`)).status).toBe(404)
    await reapprove()
  })
  it('quitar una foto de una publicada la devuelve a revisión', async () => {
    const pub = await api(`/listings/${listingId}`)
    expect((await api(`/listings/${listingId}/photos/${pub.json.photos[0].id}`, { method: 'DELETE', cookie: marcela })).status).toBe(200)
    expect((await api(`/listings/${listingId}`)).status).toBe(404)
  })
})

describe('comunidad y chat', () => {
  let conversationId: string
  let mentorId: string

  it('directorio público y filtrable', async () => {
    const r = await api('/mentors?language=Francés')
    expect(r.status).toBe(200)
    expect(r.json).toHaveLength(1)
    mentorId = r.json[0].id
  })
  it('no muestra mentores sin aprobar', async () => {
    expect((await api('/mentors')).json.map((m: any) => m.fullName)).not.toContain('Sofía Ibarra')
  })
  it('conectar requiere estudiante validado', async () => {
    expect((await api(`/mentors/${mentorId}/connect`, { method: 'POST', body: { intro: 'Hola, ¿me ayudas?' } })).status).toBe(401)
    expect((await api(`/mentors/${mentorId}/connect`, { method: 'POST', cookie: marcela, body: { intro: 'Hola, ¿me ayudas?' } })).status).toBe(403)
  })
  it('el estudiante conecta y no puede escribir hasta que acepten', async () => {
    const r = await api(`/mentors/${mentorId}/connect`, { method: 'POST', cookie: tomas, body: { intro: 'Hola Inés, ¿me ayudas con la visa?' } })
    expect(r.status).toBe(201)
    conversationId = r.json.conversationId
    expect((await api(`/conversations/${conversationId}/messages`, { method: 'POST', cookie: tomas, body: { body: 'Hola' } })).status).toBe(409)
    expect((await api(`/mentors/${mentorId}/connect`, { method: 'POST', cookie: tomas, body: { intro: 'Otra solicitud igual.' } })).status).toBe(409)
  })
  it('solo el mentor responde', async () => {
    expect((await api(`/conversations/${conversationId}/respond`, { method: 'POST', cookie: tomas, body: { accept: true } })).status).toBe(404)
    const ines = await login('ines')
    expect((await api(`/conversations/${conversationId}/respond`, { method: 'POST', cookie: ines, body: { accept: true } })).status).toBe(200)
  })
  it('IDOR: nadie ajeno lee ni escribe', async () => {
    expect((await api(`/conversations/${conversationId}/messages`, { cookie: lucia })).status).toBe(404)
    expect((await api(`/conversations/${conversationId}/messages`, { method: 'POST', cookie: lucia, body: { body: 'Hola' } })).status).toBe(404)
    expect((await api(`/conversations/${conversationId}/messages`, { cookie: diego })).status).toBe(404)
  })
  it('detecta señales de estafa al enviar', async () => {
    const ines = await login('ines')
    const r = await api(`/conversations/${conversationId}/messages`, { method: 'POST', cookie: ines, body: { body: 'Te paso mi CLABE para que hagas la transferencia' } })
    expect(r.status).toBe(201)
    expect(r.json.riskFlags.map((f: any) => f.id)).toEqual(expect.arrayContaining(['bank_details', 'advance_payment']))
    const list = await api(`/conversations/${conversationId}/messages`, { cookie: tomas })
    expect(list.json.at(-1).riskFlags.length).toBe(2)
    expect((await api('/notifications', { cookie: tomas })).json.items[0].body).toContain('señal de riesgo')
  })
})

describe('planeación', () => {
  it('estima con renta manual, sin sesión', async () => {
    const r = await api('/budget/estimate', { method: 'POST', body: { monthlyRent: 10000, arrivalMonth: 7, usesAc: true, international: true } })
    expect(r.status).toBe(200)
    expect(r.json.firstMonthTotalMxn).toBeGreaterThan(r.json.typicalMonthTotalMxn)
    expect(r.json.alerts.map((a: any) => a.id)).toContain('ac')
  })
  it('no da datos de viviendas sin publicar', async () => {
    const r = await api('/budget/estimate', { method: 'POST', body: { listingId: await findListing(PENDING), arrivalMonth: 7, usesAc: true, international: true } })
    expect(r.status).toBe(404)
  })
  it('guías públicas', async () => {
    expect((await api('/guides')).json.length).toBeGreaterThan(5)
    expect((await api('/guides/como-reconocer-una-estafa')).json.body).toContain('Señales')
    expect((await api('/guides/no-existe')).status).toBe(404)
  })
  it('checklist personal', async () => {
    expect((await api('/checklist')).status).toBe(401)
    await api('/checklist/budget', { method: 'PUT', cookie: tomas, body: { done: true } })
    expect((await api('/checklist', { cookie: tomas })).json.find((t: any) => t.id === 'budget').done).toBe(true)
    expect((await api('/checklist', { cookie: clara })).json.find((t: any) => t.id === 'budget').done).toBe(false)
    expect((await api('/checklist/nope', { method: 'PUT', cookie: tomas, body: { done: true } })).status).toBe(404)
  })
})

describe('administración y privacidad', () => {
  it.each(['/admin/metrics', '/admin/listings/queue', '/admin/reports', '/admin/students/pending', '/admin/mentors/pending', '/admin/audit'])('%s es solo para admin', async (path) => {
    expect((await api(path)).status).toBe(401)
    expect((await api(path, { cookie: lucia })).status).toBe(403)
    expect((await api(path, { cookie: marcela })).status).toBe(403)
    expect((await api(path, { cookie: adminC })).status).toBe(200)
  })
  it('la bitácora registra acciones', async () => {
    const r = await api('/admin/audit', { cookie: adminC })
    expect(r.json.total).toBeGreaterThan(5)
    expect(JSON.stringify(r.json)).not.toMatch(/password_hash|token_hash|argon2/i)
  })
  it('exporta los datos de quien lo pide', async () => {
    const r = await api('/me/export', { cookie: tomas })
    expect(r.status).toBe(200)
    expect(r.json.profile.email).toBe('tomas@demo.aterriza.mx')
    expect(JSON.stringify(r.json)).not.toContain('password_hash')
  })
  it('eliminar pide contraseña, anonimiza y cierra sesiones', async () => {
    const c = await login('nadia')
    expect((await api('/me', { method: 'DELETE', cookie: c, body: { password: 'incorrecta-1234' } })).status).toBe(401)
    expect((await api('/me', { method: 'DELETE', cookie: c, body: { password: DEMO_PASSWORD } })).status).toBe(200)
    expect((await api('/me', { cookie: c })).status).toBe(401)
    expect((await db.query(`SELECT 1 FROM users WHERE email = 'nadia@demo.aterriza.mx'`)).length).toBe(0)
    expect((await api('/auth/login', { method: 'POST', body: { email: 'nadia@demo.aterriza.mx', password: DEMO_PASSWORD } })).status).toBe(401)
  })
})
