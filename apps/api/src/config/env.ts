import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().optional(),
  /** Conexión directa, sin pooler: solo para migrar con candado (Neon la inyecta así). */
  DATABASE_URL_UNPOOLED: z.string().optional(),
  /** `dedicated` confirma que DATABASE_URL es una base exclusiva de la demo, solo con datos ficticios. */
  DEMO_DATABASE: z.string().optional(),
  APP_SECRET: z.string().optional(),
  PUBLIC_ORIGIN: z.string().default('http://localhost:5173'),
  DEMO_MODE: z.string().optional(),
  PUBLIC_DEMO: z.string().optional(),
  DEMO_ACCESS_PASSWORD: z.string().optional(),
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  SERVE_WEB: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  INSTITUTIONAL_DOMAINS: z.string().default('tec.mx,itesm.mx'),
})

export interface AppConfig {
  env: 'development' | 'test' | 'production'
  isProduction: boolean
  port: number
  host: string
  databaseUrl: string | null
  /** Para migrar y sembrar con candado. Si no hay, se usa databaseUrl. */
  setupDatabaseUrl: string | null
  appSecret: string
  allowedOrigins: string[]
  demoMode: boolean
  /** Demo en internet: base en memoria y contraseña compartida. Nunca guarda nada real. */
  publicDemo: boolean
  demoAccessPassword: string | null
  /** En la demo con varias instancias no hay disco compartido: no se aceptan fotos nuevas. */
  uploadsEnabled: boolean
  serveWeb: boolean
  trustProxy: boolean
  institutionalDomains: string[]
}

/** Falla al arrancar si la configuración es insegura (RNF-12). */
export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const e = envSchema.parse(source)
  const isProduction = e.NODE_ENV === 'production'
  const publicDemo = e.PUBLIC_DEMO === 'true'
  const demoMode = publicDemo || e.DEMO_MODE === 'true'
  const accessPassword = e.DEMO_ACCESS_PASSWORD || null
  const problems: string[] = []

  if (publicDemo) {
    // Las cuentas de demo tienen contraseña conocida: nunca junto a una base real, y nunca sin barrera.
    // Una base compartida solo se acepta si se declara exclusiva de la demo.
    if (e.DATABASE_URL && e.DEMO_DATABASE !== 'dedicated') {
      problems.push('PUBLIC_DEMO con DATABASE_URL exige DEMO_DATABASE=dedicated: la base debe ser exclusiva de la demo, solo con datos ficticios.')
    }
    // Con varias instancias, cada una inventaría su propio secreto y los códigos de una no valdrían en otra.
    if (e.DATABASE_URL && (!e.APP_SECRET || e.APP_SECRET.length < 32)) problems.push('APP_SECRET debe tener al menos 32 caracteres cuando la demo usa una base compartida.')
    if (!accessPassword || accessPassword.length < 12) problems.push('DEMO_ACCESS_PASSWORD debe tener al menos 12 caracteres.')
  } else if (isProduction) {
    if (demoMode) problems.push('DEMO_MODE no se permite en producción: crea cuentas con contraseña conocida.')
    if (!e.APP_SECRET || e.APP_SECRET.length < 32) problems.push('APP_SECRET debe tener al menos 32 caracteres.')
    if (!e.DATABASE_URL) problems.push('DATABASE_URL es obligatoria en producción.')
    if (!e.PUBLIC_ORIGIN.startsWith('https://')) problems.push('PUBLIC_ORIGIN debe usar https.')
  }
  if (problems.length > 0) {
    throw new Error(`Configuración insegura:\n- ${problems.join('\n- ')}`)
  }

  const vercelOrigins = [e.VERCEL_URL, e.VERCEL_BRANCH_URL, e.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map((host) => `https://${host}`)
  const allowedOrigins = isProduction
    ? [e.PUBLIC_ORIGIN, ...vercelOrigins]
    : [...vercelOrigins, ...new Set([e.PUBLIC_ORIGIN, 'http://localhost:5173', 'http://localhost:4000', 'http://127.0.0.1:4000', 'http://127.0.0.1:5173'])]

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL || null,
    setupDatabaseUrl: e.DATABASE_URL_UNPOOLED || e.DATABASE_URL || null,
    appSecret: e.APP_SECRET || randomBytes(32).toString('hex'),
    allowedOrigins,
    demoMode,
    publicDemo,
    demoAccessPassword: publicDemo ? accessPassword : null,
    uploadsEnabled: !publicDemo,
    serveWeb: isProduction || e.SERVE_WEB === 'true',
    // Detrás del proxy de Vercel, la IP real viene en una cabecera que él mismo fija.
    trustProxy: e.TRUST_PROXY === 'true' || e.VERCEL === '1',
    institutionalDomains: e.INSTITUTIONAL_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
  }
}
