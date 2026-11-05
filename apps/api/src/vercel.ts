import type { IncomingMessage, ServerResponse } from 'node:http'
import { bootstrap } from './bootstrap.ts'

// La función no abre un puerto: Vercel le entrega cada petición. El arranque se comparte entre peticiones.
const booted = bootstrap().then(async (b) => {
  await b.app.ready()
  return b
})

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { app } = await booted
  app.server.emit('request', req, res)
}
