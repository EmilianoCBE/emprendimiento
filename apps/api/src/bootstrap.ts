import { type AppHandle, createApp } from './composition.ts'
import { type AppConfig, loadConfig } from './config/env.ts'
import { type Db, createDb, migrate } from './platform/db.ts'
import { seedBase, seedDemo } from './seed/seed.ts'

export interface Booted extends AppHandle {
  config: AppConfig
  db: Db
}

/** Prepara base de datos y servidor. Común al proceso local y a la función de Vercel. */
export async function bootstrap(): Promise<Booted> {
  const config = loadConfig()
  const db = createDb(config.databaseUrl, { inMemory: config.publicDemo })
  // Migrar y sembrar por la conexión directa y con candado: varias instancias pueden arrancar al mismo tiempo.
  const separateSetup = config.setupDatabaseUrl && config.setupDatabaseUrl !== config.databaseUrl
  const setupDb = separateSetup ? createDb(config.setupDatabaseUrl) : db
  try {
    await setupDb.exclusive(async (locked) => {
      await migrate(locked)
      await seedBase(locked)
      if (config.demoMode) await seedDemo(locked)
    })
  } finally {
    if (separateSetup) await setupDb.close()
  }
  const handle = await createApp(config, db)
  return { ...handle, config, db }
}
