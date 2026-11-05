import { createDb, migrate } from '../platform/db.ts'
import { seedBase, seedDemo } from '../seed/seed.ts'

/**
 * Reinicia la base compartida de la demo en línea (Neon) a sus datos iniciales.
 * Uso, desde una carpeta vinculada al proyecto de Vercel:
 *   npx vercel env run -e production -- npm run db:reset-demo -w @aterriza/api -- --confirmar
 *
 * Doble seguro: exige --confirmar y solo actúa si la base ya tiene la cuenta de administración de demostración.
 */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL.')
  process.exit(1)
}
if (!process.argv.includes('--confirmar')) {
  console.error('Borra todos los datos de la demo en línea y los vuelve a sembrar. Repite con --confirmar.')
  process.exit(1)
}

const db = createDb(url)
try {
  await db.exclusive(async (locked) => {
    const [isDemo] = await locked.query(`SELECT 1 FROM users WHERE email = 'admin@demo.aterriza.mx'`).catch(() => [])
    if (!isDemo) throw new Error('Esta base no parece la de la demo: no se tocó nada.')
    const tables = await locked.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    // Los nombres vienen del catálogo de Postgres, no de una entrada externa; aun así se citan.
    await locked.exec(`DROP TABLE IF EXISTS ${tables.map((t) => `"${t.tablename.replaceAll('"', '""')}"`).join(', ')} CASCADE`)
    await migrate(locked)
    await seedBase(locked)
    await seedDemo(locked)
  })
  console.info('Demo reiniciada: datos iniciales y todas las sesiones cerradas.')
} finally {
  await db.close()
}
