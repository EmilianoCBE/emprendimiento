import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

/** Puerto de base de datos: los repositorios no saben qué motor hay detrás. */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}
export interface Db extends Queryable {
  /** Dentro de `fn` hay que usar el `tx` recibido, nunca `db`: PGlite tiene una sola conexión. */
  tx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>
  exec(sql: string): Promise<void>
  close(): Promise<void>
  /**
   * Corre `fn` con un candado que comparten todas las instancias: si varias arrancan a la vez,
   * solo una migra y siembra, y las demás esperan y encuentran el trabajo hecho.
   */
  exclusive<T>(fn: (db: Db) => Promise<T>): Promise<T>
}

/** Número fijo del candado de arranque. Cualquier entero de 64 bits sirve mientras sea siempre el mismo. */
const SETUP_LOCK = 7_204_190_311

/** Adaptador para desarrollo, demo y pruebas: Postgres embebido, sin instalar nada. */
export class PgliteDb implements Db {
  private readonly client: PGlite
  constructor(dataDir?: string) {
    if (dataDir) mkdirSync(dataDir, { recursive: true })
    this.client = new PGlite(dataDir)
  }
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.client.query<T>(sql, params)).rows
  }
  tx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return this.client.transaction(async (tx) =>
      fn({ query: async <R>(sql: string, params: unknown[] = []) => (await tx.query<R>(sql, params)).rows }),
    ) as Promise<T>
  }
  async exec(sql: string): Promise<void> {
    await this.client.exec(sql)
  }
  async close(): Promise<void> {
    await this.client.close()
  }
  /** Un solo proceso usa esta base: no hace falta candado. */
  exclusive<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return fn(this)
  }
}

/** Adaptador para Postgres gestionado (Neon en la demo, Supabase en producción). */
export class PgDb implements Db {
  private readonly pool: pg.Pool
  constructor(connectionString: string, caCertPath?: string) {
    this.pool = new pg.Pool({
      connectionString: withoutSslMode(connectionString),
      // Cada instancia de Vercel tiene su pool: pocas conexiones por instancia, el pooler de Neon reparte el resto.
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      // Sin desactivar la verificación de TLS. Supabase firma con su propia CA: descárgala de su panel.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: true, ...(caCertPath ? { ca: readFileSync(caCertPath, 'utf8') } : {}) },
    })
  }
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query(sql, params)).rows as T[]
  }
  async tx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn({
        query: async <R>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[],
      })
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
  async exec(sql: string): Promise<void> {
    await this.pool.query(sql)
  }
  async close(): Promise<void> {
    await this.pool.end()
  }
  /**
   * Candado de sesión de Postgres sobre una sola conexión. Requiere conexión directa:
   * a través de un pooler en modo transacción el candado podría quedar en otra sesión.
   */
  async exclusive<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const run = async <R>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[]
    const onClient: Db = {
      query: run,
      exec: async (sql) => {
        await client.query(sql)
      },
      tx: async (inner) => {
        await client.query('BEGIN')
        try {
          const result = await inner({ query: run })
          await client.query('COMMIT')
          return result
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        }
      },
      close: async () => {},
      exclusive: (inner) => inner(onClient),
    }
    try {
      await client.query('SELECT pg_advisory_lock($1)', [SETUP_LOCK])
      return await fn(onClient)
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SETUP_LOCK]).catch(() => {})
      client.release()
    }
  }
}

/**
 * Quita `sslmode` de la URL: si se queda, decide el TLS por encima de `ssl` y en `pg` 9 `require` dejará de
 * verificar el certificado. Así siempre manda la configuración explícita de arriba, que sí lo verifica.
 */
function withoutSslMode(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    return url.toString()
  } catch {
    return connectionString
  }
}

const here = dirname(fileURLToPath(import.meta.url))
export const API_ROOT = join(here, '..', '..')
export const LOCAL_DATA_DIR = join(API_ROOT, '.data', 'pglite')

/** Factory Method: elige el adaptador según la configuración. */
export function createDb(databaseUrl: string | null, opts: { inMemory?: boolean } = {}): Db {
  if (databaseUrl) return new PgDb(databaseUrl, process.env.DATABASE_CA_CERT)
  return new PgliteDb(opts.inMemory ? undefined : LOCAL_DATA_DIR)
}

export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  await db.exec('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY')
  const applied = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name))
  const dir = join(API_ROOT, 'migrations')
  const pending = readdirSync(dir).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort()
  for (const file of pending) {
    await db.exec(readFileSync(join(dir, file), 'utf8'))
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
  }
  return pending
}
