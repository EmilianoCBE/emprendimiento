import { loadConfig } from './config/env.ts'
import { createApp } from './composition.ts'
import { createDb, migrate } from './platform/db.ts'
import { seedBase, seedDemo } from './seed/seed.ts'

const config = loadConfig()
const db = createDb(config.databaseUrl)
await migrate(db)
await seedBase(db)
if (config.demoMode) await seedDemo(db)

const { app, close } = await createApp(config, db)
await app.listen({ port: config.port, host: config.host })
console.info(`Aterriza API en http://${config.host}:${config.port}${config.demoMode ? ' (modo demo)' : ''}`)

let closing = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (closing) return
    closing = true
    await close()
    await db.close()
    process.exit(0)
  })
}
