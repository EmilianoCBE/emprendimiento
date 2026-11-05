import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { FileStore } from './kernel.ts'
import { API_ROOT } from './db.ts'

export const UPLOADS_DIR = join(API_ROOT, 'uploads')

/** Adaptador local. En producción se sustituye por Supabase Storage con el mismo puerto. */
export class LocalFileStore implements FileStore {
  constructor(private readonly dir = UPLOADS_DIR) {
    mkdirSync(dir, { recursive: true })
  }
  async save(bytes: Buffer, extension: string): Promise<string> {
    // El nombre es aleatorio: el del usuario nunca llega al disco.
    const name = `${randomUUID()}.${extension}`
    await writeFile(join(this.dir, name), bytes, { flag: 'wx' })
    return `/uploads/${name}`
  }
  async remove(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return // Fotos de demo u otros orígenes.
    await unlink(join(this.dir, basename(url))).catch(() => {})
  }
}

/** Identifica la imagen por su firma binaria, no por lo que declara el cliente. SVG no se admite. */
export function detectImageType(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  return null
}
