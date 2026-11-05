import { loadConfig } from '../config/env.ts'
import { createDb, migrate } from '../platform/db.ts'

const db = createDb(loadConfig().databaseUrl)
const applied = await migrate(db)
console.info(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Sin migraciones pendientes.')
await db.close()
