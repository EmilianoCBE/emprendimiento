import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().optional(),
  APP_SECRET: z.string().optional(),
  PUBLIC_ORIGIN: z.string().default('http://localhost:5173'),
  DEMO_MODE: z.string().optional(),
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
  appSecret: string
  allowedOrigins: string[]
  demoMode: boolean
  serveWeb: boolean
  trustProxy: boolean
  institutionalDomains: string[]
}

/** Falla al arrancar si la configuración es insegura (RNF-12). */
export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const e = envSchema.parse(source)
  const isProduction = e.NODE_ENV === 'production'
  const demoMode = e.DEMO_MODE === 'true'
  const problems: string[] = []

  if (isProduction) {
    if (demoMode) problems.push('DEMO_MODE no se permite en producción: crea cuentas con contraseña conocida.')
    if (!e.APP_SECRET || e.APP_SECRET.length < 32) problems.push('APP_SECRET debe tener al menos 32 caracteres.')
    if (!e.DATABASE_URL) problems.push('DATABASE_URL es obligatoria en producción.')
    if (!e.PUBLIC_ORIGIN.startsWith('https://')) problems.push('PUBLIC_ORIGIN debe usar https.')
  }
  if (problems.length > 0) {
    throw new Error(`Configuración insegura:\n- ${problems.join('\n- ')}`)
  }

  const allowedOrigins = isProduction
    ? [e.PUBLIC_ORIGIN]
    : [...new Set([e.PUBLIC_ORIGIN, 'http://localhost:5173', 'http://localhost:4000', 'http://127.0.0.1:4000', 'http://127.0.0.1:5173'])]

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL || null,
    appSecret: e.APP_SECRET || randomBytes(32).toString('hex'),
    allowedOrigins,
    demoMode,
    serveWeb: isProduction || e.SERVE_WEB === 'true',
    trustProxy: e.TRUST_PROXY === 'true',
    institutionalDomains: e.INSTITUTIONAL_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
  }
}
