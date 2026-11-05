import type { IncomingMessage, ServerResponse } from 'node:http'
import { type Booted, bootstrap } from './bootstrap.ts'

// La función no abre un puerto: Vercel le entrega cada petición. El arranque se comparte entre peticiones.
let booting: Promise<Booted> | null = null

function boot(): Promise<Booted> {
  booting ??= bootstrap()
    .then(async (b) => {
      await b.app.ready()
      return b
    })
    .catch((err: unknown) => {
      // Si la base tarda en despertar o corta la conexión, la siguiente petición vuelve a intentarlo
      // en vez de dejar la instancia rota para siempre.
      booting = null
      throw err
    })
  return booting
}
void boot().catch(() => {})

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let app: Booted['app']
  try {
    ;({ app } = await boot())
  } catch (err) {
    console.error('No se pudo arrancar la API', err)
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('retry-after', '5')
    res.end(JSON.stringify({ error: { code: 'starting', message: 'El servidor está arrancando. Vuelve a intentar en unos segundos.' } }))
    return
  }
  app.server.emit('request', req, res)
}
