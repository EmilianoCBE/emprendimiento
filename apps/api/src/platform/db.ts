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
}

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
}

/** Adaptador para Postgres gestionado (Supabase en producción). */
export class PgDb implements Db {
  private readonly pool: pg.Pool
  constructor(connectionString: string, caCertPath?: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
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
