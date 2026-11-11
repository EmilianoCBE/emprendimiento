import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/env.ts'
import { BOOKING_MACHINE, allowedActions, evaluateBooking, nextStatus, type BookingContext } from '../src/modules/bookings/domain.ts'
import { isInstitutionalEmail, passwordProblems, validationMethodFor } from '../src/modules/identity/domain.ts'
import { BelowMedianPolicy, SqlWhereBuilder, benchmarkFor, escapeLike, median, priceCategory, verificationLevel } from '../src/modules/listings/domain.ts'
import { defaultEstimator, isHotSeason, type CostContext } from '../src/modules/planning/domain.ts'
import { DistinctReportersPolicy, detectScamSignals, trustScore } from '../src/modules/trust/domain.ts'
import { detectImageType } from '../src/platform/files.ts'

describe('sello de verificación', () => {
  it.each([[4, 'verified'], [3, 'partial'], [2, 'partial'], [1, 'unverified'], [0, 'unverified']])('%i criterios: %s', (n, level) => {
    expect(verificationLevel(n as number)).toBe(level)
  })
})

describe('alerta de precio', () => {
  const policy = new BelowMedianPolicy()
  it('no alerta si está cerca de la mediana', () => expect(policy.evaluate(9000, { median: 10000, scope: 'zone' })).toBeNull())
  it('avisa a partir de 20% abajo', () => expect(policy.evaluate(8000, { median: 10000, scope: 'zone' })?.severity).toBe('warning'))
  it('marca peligro a partir de 35% abajo', () => {
    const alert = policy.evaluate(6500, { median: 10000, scope: 'zone' })
    expect(alert?.severity).toBe('danger')
    expect(alert?.percentBelow).toBe(35)
  })
  it('usa la zona con muestra suficiente y la ciudad si no', () => {
    expect(benchmarkFor([1, 2, 3], [9, 9, 9])).toEqual({ median: 2, scope: 'zone' })
    expect(benchmarkFor([1, 2], [9, 9, 9])).toEqual({ median: 9, scope: 'city' })
  })
  it('compara viviendas parecidas', () => {
    expect(priceCategory('room')).toBe(priceCategory('residence'))
    expect(priceCategory('studio')).toBe(priceCategory('apartment'))
    expect(priceCategory('room')).not.toBe(priceCategory('apartment'))
  })
  it('mediana con cantidad par', () => expect(median([1000, 2000])).toBe(1500))
})

describe('constructor de consultas', () => {
  it('parametriza valores y omite los vacíos', () => {
    const b = new SqlWhereBuilder().where('a').whereIf(undefined, 'b = $?').whereIf(5, 'c = $?')
    expect(b.toSql()).toBe('WHERE a AND c = $1')
    expect(b.params).toEqual([5])
  })
  it('un intento de inyección queda como parámetro', () => {
    const b = new SqlWhereBuilder().whereIf(`'; DROP TABLE users;--`, 'x = $?')
    expect(b.toSql()).not.toContain('DROP')
  })
  it('escapa comodines de LIKE', () => expect(escapeLike('50%_a')).toBe('50\\%\\_a'))
})

describe('máquina de estados de solicitudes', () => {
  it('solo el arrendador acepta', () => {
    expect(nextStatus('requested', 'accept', 'landlord')).toBe('accepted')
    expect(nextStatus('requested', 'accept', 'student')).toBeNull()
  })
  it('solo el estudiante confirma', () => {
    expect(nextStatus('accepted', 'confirm', 'student')).toBe('confirmed')
    expect(nextStatus('accepted', 'confirm', 'landlord')).toBeNull()
  })
  it('un estado final no admite acciones', () => {
    for (const s of ['completed', 'rejected', 'cancelled'] as const) expect(BOOKING_MACHINE[s]).toEqual({})
  })
  it('no se puede saltar pasos', () => expect(nextStatus('requested', 'complete', 'landlord')).toBeNull())
  it('una confirmada no se cancela desde aquí', () => expect(allowedActions('confirmed', 'student')).toEqual([]))
})

describe('reglas para solicitar', () => {
  const ok: BookingContext = {
    listingStatus: 'active', level: 'verified', occupied: false, isOwner: false, actorRole: 'student', studentValidated: true,
    hasActiveBooking: false, minMonths: 5, startDate: '2027-01-10', endDate: '2027-06-20', today: '2026-11-04', fraudNoticeAck: true,
  }
  it('pasa con todo en orden', () => expect(evaluateBooking(ok)).toEqual([]))
  it('devuelve todas las razones juntas', () => {
    expect(evaluateBooking({ ...ok, level: 'partial', fraudNoticeAck: false, studentValidated: false })).toHaveLength(3)
  })
  it('exige el plazo mínimo', () => {
    expect(evaluateBooking({ ...ok, endDate: '2027-02-10' }).join()).toContain('plazo mínimo')
  })
  it('rechaza fechas invertidas y pasadas', () => {
    expect(evaluateBooking({ ...ok, endDate: '2027-01-01' }).length).toBeGreaterThan(0)
    expect(evaluateBooking({ ...ok, startDate: '2020-01-01' }).join()).toContain('ya pasó')
  })
})

describe('calculadora', () => {
  const base: CostContext = {
    rent: 10000, depositMonths: 1, utilitiesIncluded: false, minutesTransit: 10, arrivalMonth: 8, usesAc: true, international: true,
    assumptions: { electricity_hot_ac: 1400, electricity_mild: 450, internet: 450, transport_near: 500, transport_far: 1400, food: 4000, phone: 300, bank_fees: 350, setup: 2500 },
  }
  const line = (ctx: CostContext, id: string) => defaultEstimator().estimate(ctx).lines.find((l) => l.id === id)

  it('la luz sube con aire en temporada de calor', () => {
    expect(line(base, 'electricity')?.amountMxn).toBe(1400)
    expect(line({ ...base, arrivalMonth: 1 }, 'electricity')?.amountMxn).toBe(450)
    expect(line({ ...base, usesAc: false }, 'electricity')?.amountMxn).toBe(450)
  })
  it('sin luz ni internet cuando los servicios están incluidos', () => {
    expect(line({ ...base, utilitiesIncluded: true }, 'electricity')).toBeUndefined()
    expect(line({ ...base, utilitiesIncluded: true }, 'internet')).toBeUndefined()
  })
  it('el depósito solo cuenta el primer mes', () => {
    const e = defaultEstimator().estimate(base)
    expect(e.firstMonthTotalMxn - e.typicalMonthTotalMxn).toBe(10000 + 2500)
  })
  it('comisiones solo para internacionales', () => {
    expect(line({ ...base, international: false }, 'bank_fees')).toBeUndefined()
    expect(line(base, 'bank_fees')).toBeDefined()
  })
  it('separa datos del anuncio y estimaciones', () => {
    const e = defaultEstimator().estimate(base)
    expect(e.lines.find((l) => l.id === 'rent')?.source).toBe('listing')
    expect(e.estimatedShareMxn).toBe(e.firstMonthTotalMxn - 20000)
  })
  it('alerta del recibo de luz en calor', () => {
    expect(defaultEstimator().estimate(base).alerts.map((a) => a.id)).toContain('ac')
    expect(defaultEstimator().estimate({ ...base, arrivalMonth: 1 }).alerts.map((a) => a.id)).not.toContain('ac')
  })
  it('temporada de calor', () => {
    expect(isHotSeason(5) && isHotSeason(9)).toBe(true)
    expect(isHotSeason(4) || isHotSeason(10)).toBe(false)
  })
})

describe('confianza', () => {
  it('una reseña de 5 no infla el puntaje', () => {
    expect(trustScore([5])).toBeLessThan(trustScore([5, 5, 5, 5, 5, 5, 5, 5])!)
    expect(trustScore([])).toBeNull()
  })
  it('tres personas distintas marcan la vivienda', () => {
    const p = new DistinctReportersPolicy()
    expect(p.shouldFlag(2)).toBe(false)
    expect(p.shouldFlag(3)).toBe(true)
  })
})

describe('señales de estafa', () => {
  it.each([
    ['Hazme una transferencia para apartar', 'advance_payment'],
    ['Te paso la CLABE y me depositas', 'bank_details'],
    ['012 345 678 901 234 567', 'bank_details'],
    ['Mejor escríbeme por WhatsApp', 'off_platform'],
    ['Mi número es 81 1234 5678', 'off_platform'],
    ['Hay más interesados, decide ya', 'urgency'],
    ['Solo efectivo, no doy recibos', 'cash_no_receipt'],
    ['TRANSFERÍ el anticipo', 'advance_payment'],
  ])('"%s" => %s', (text, flag) => expect(detectScamSignals(text)).toContain(flag))

  it.each(['Hola, ¿cómo llego al campus en camión?', 'El departamento tiene dos recámaras.', 'Hay un oxxo cerca de la casa'])('sin falsa alarma: "%s"', (text) => {
    expect(detectScamSignals(text)).toEqual([])
  })
})

describe('identidad', () => {
  it('reconoce dominios institucionales exactos y subdominios', () => {
    expect(isInstitutionalEmail('a@tec.mx', ['tec.mx'])).toBe(true)
    expect(isInstitutionalEmail('a@sub.tec.mx', ['tec.mx'])).toBe(true)
    expect(isInstitutionalEmail('a@faketec.mx', ['tec.mx'])).toBe(false)
    expect(isInstitutionalEmail('a@tec.mx.evil.com', ['tec.mx'])).toBe(false)
  })
  it('sin correo institucional confirmado, revisión manual', () => {
    expect(validationMethodFor('a@tec.mx', true, ['tec.mx'])).toBe('institutional_email')
    expect(validationMethodFor('a@tec.mx', false, ['tec.mx'])).toBe('manual')
    expect(validationMethodFor('a@gmail.com', true, ['tec.mx'])).toBe('manual')
  })
  it('rechaza contraseñas débiles', () => {
    expect(passwordProblems('1234567890', 'a@b.mx')).not.toEqual([])
    expect(passwordProblems('aaaaaaaaaa', 'a@b.mx')).not.toEqual([])
    expect(passwordProblems('lucia-en-monterrey', 'lucia@b.mx')).not.toEqual([])
    expect(passwordProblems('cielo-azul-sobre-sierra', 'lucia@b.mx')).toEqual([])
  })
})

describe('archivos', () => {
  it('identifica por firma, no por lo que diga el cliente', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('jpg')
    expect(detectImageType(Buffer.from('<svg onload=alert(1)></svg>'))).toBeNull()
    expect(detectImageType(Buffer.from('<?php echo 1; ?>  '))).toBeNull()
  })
})

describe('configuración', () => {
  const secure = { NODE_ENV: 'production', APP_SECRET: 'x'.repeat(32), DATABASE_URL: 'postgres://h/db', PUBLIC_ORIGIN: 'https://aterriza.mx' }
  it('acepta producción segura', () => expect(loadConfig(secure).isProduction).toBe(true))
  it('rechaza modo demo en producción', () => expect(() => loadConfig({ ...secure, DEMO_MODE: 'true' })).toThrow(/DEMO_MODE/))
  it('rechaza secreto corto', () => expect(() => loadConfig({ ...secure, APP_SECRET: 'corto' })).toThrow(/APP_SECRET/))
  describe('demo pública', () => {
    const demo = { NODE_ENV: 'production', PUBLIC_DEMO: 'true', DEMO_ACCESS_PASSWORD: 'una-clave-larga-1', VERCEL_URL: 'a.vercel.app' }
    it('arranca con base en memoria', () => {
      const c = loadConfig(demo)
      expect(c.publicDemo && c.demoMode).toBe(true)
      expect(c.allowedOrigins).toContain('https://a.vercel.app')
    })
    it('es abierta salvo que se pida la barrera', () => {
      expect(loadConfig(demo).demoAccessPassword).toBeNull()
      expect(loadConfig({ ...demo, DEMO_ACCESS_PASSWORD: undefined }).demoAccessPassword).toBeNull()
      expect(loadConfig({ ...demo, DEMO_GATE: 'on' }).demoAccessPassword).toBe('una-clave-larga-1')
    })
    it('con barrera exige contraseña de al menos 12 caracteres', () => {
      expect(() => loadConfig({ ...demo, DEMO_GATE: 'on', DEMO_ACCESS_PASSWORD: undefined })).toThrow(/DEMO_ACCESS_PASSWORD/)
      expect(() => loadConfig({ ...demo, DEMO_GATE: 'on', DEMO_ACCESS_PASSWORD: 'corta' })).toThrow(/DEMO_ACCESS_PASSWORD/)
    })
    it('no acepta una base sin declararla exclusiva de la demo', () => {
      expect(() => loadConfig({ ...demo, DATABASE_URL: 'postgres://h/db', APP_SECRET: 'x'.repeat(32) })).toThrow(/DEMO_DATABASE/)
    })
    it('con base compartida exige un secreto común a todas las instancias', () => {
      expect(() => loadConfig({ ...demo, DATABASE_URL: 'postgres://h/db', DEMO_DATABASE: 'dedicated' })).toThrow(/APP_SECRET/)
      const c = loadConfig({ ...demo, DATABASE_URL: 'postgres://h/db', DATABASE_URL_UNPOOLED: 'postgres://d/db', DEMO_DATABASE: 'dedicated', APP_SECRET: 'x'.repeat(32) })
      expect(c.setupDatabaseUrl).toBe('postgres://d/db')
      expect(c.uploadsEnabled).toBe(false)
    })
    it('DEMO_MODE solo sigue prohibido en producción', () => {
      expect(() => loadConfig({ NODE_ENV: 'production', DEMO_MODE: 'true', APP_SECRET: 'x'.repeat(32), DATABASE_URL: 'postgres://h/db', PUBLIC_ORIGIN: 'https://a.mx' })).toThrow(/DEMO_MODE/)
    })
  })
  it('rechaza http en producción', () => expect(() => loadConfig({ ...secure, PUBLIC_ORIGIN: 'http://a.mx' })).toThrow(/https/))
})
