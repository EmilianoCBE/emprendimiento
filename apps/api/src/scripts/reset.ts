import { rmSync } from 'node:fs'
import { loadConfig } from '../config/env.ts'
import { LOCAL_DATA_DIR } from '../platform/db.ts'

// Solo borra datos locales de PGlite; nunca toca una base remota.
if (loadConfig().databaseUrl) {
  console.error('db:reset solo funciona con la base local. Quita DATABASE_URL para usarlo.')
  process.exit(1)
}
rmSync(LOCAL_DATA_DIR, { recursive: true, force: true })
console.info('Datos locales eliminados. Se volverán a crear al arrancar.')
