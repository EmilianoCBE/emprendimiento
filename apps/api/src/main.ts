import { bootstrap } from './bootstrap.ts'

const { app, close, config, db } = await bootstrap()
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
