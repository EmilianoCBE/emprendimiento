/**
 * seedBase: contenido del producto, necesario en cualquier entorno (zonas, supuestos, guías, checklist).
 * seedDemo: personas y viviendas FICTICIAS para la demostración. Nunca se ejecuta en producción.
 */
import { CRITERIA, type Criterion } from '@aterriza/contracts'
import type { Db } from '../platform/db.ts'
import { hashPassword } from '../modules/identity/service.ts'
import { approximateNear } from '../modules/listings/domain.ts'
import { detectScamSignals } from '../modules/trust/domain.ts'
import { CHECKLIST, COST_ASSUMPTIONS, GUIDES, ZONES } from './content.ts'

export const DEMO_PASSWORD = 'Aterriza-Demo-2026'

export async function seedBase(db: Db): Promise<void> {
  for (const z of ZONES) {
    await db.query(
      `INSERT INTO zones (slug, name, lat, lng, transit_note, life_note) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO NOTHING`,
      [z.slug, z.name, z.lat, z.lng, z.transit, z.life],
    )
  }
  for (const a of COST_ASSUMPTIONS) {
    await db.query('INSERT INTO cost_assumptions (key, amount_mxn, label, note) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING', [a.key, a.amount, a.label, a.note])
  }
  for (const [i, g] of GUIDES.entries()) {
    await db.query(
      `INSERT INTO guides (slug, category, title, summary, body, reviewed_on, position) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (slug) DO NOTHING`,
      [g.slug, g.category, g.title, g.summary, g.body, '2026-11-04', i],
    )
  }
  for (const [i, t] of CHECKLIST.entries()) {
    await db.query('INSERT INTO checklist_tasks (id, phase, title, hint, position) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', [t.id, t.phase, t.title, t.hint, i])
  }
}

interface DemoListing {
  key: string
  landlord: string
  zone: string
  title: string
  description: string
  kind: 'room' | 'studio' | 'apartment' | 'residence'
  rent: number
  deposit: number
  minMonths: number
  semester: boolean
  walk: number
  transit: number
  furnished: boolean
  utilities: boolean
  ac: boolean
  address: string
  met: Criterion[] | 'all'
  status?: 'active' | 'pending_review' | 'draft'
  photos: [string, string][]
  costs: [string, boolean, number | null][]
}

const LISTINGS: DemoListing[] = [
  {
    key: 'roma-cuarto', landlord: 'marcela', zone: 'tecnologico', title: 'Cuarto con baño propio a 8 minutos del campus',
    description: 'Cuarto amueblado en departamento compartido con otras dos estudiantes. Cocina equipada, lavadora y escritorio en el cuarto. Contrato por semestre con recibo mensual.',
    kind: 'room', rent: 9800, deposit: 1, minMonths: 5, semester: true, walk: 8, transit: 6, furnished: true, utilities: true, ac: true,
    address: 'Calle Demo 120, Col. Tecnológico, Monterrey', met: 'all',
    photos: [['cuarto-escritorio', 'Recámara con escritorio y cama matrimonial'], ['cocina-depa', 'Cocina del departamento'], ['sala-sofa', 'Sala compartida con sofá']],
    costs: [['Agua', true, null], ['Luz', true, null], ['Internet', true, null], ['Limpieza de áreas comunes', true, null], ['Lavandería', false, 200]],
  },
  {
    key: 'tec-depa', landlord: 'marcela', zone: 'tecnologico', title: 'Departamento de una recámara junto a Av. Garza Sada',
    description: 'Departamento completo, amueblado, con aire acondicionado en recámara y sala. Ideal para quien prefiere vivir sin roomies. Admite contrato de 5 meses.',
    kind: 'apartment', rent: 14500, deposit: 1, minMonths: 5, semester: true, walk: 12, transit: 8, furnished: true, utilities: false, ac: true,
    address: 'Av. Demo 2450, Col. Tecnológico, Monterrey', met: 'all',
    photos: [['depa-sala-comedor', 'Sala, comedor y cama en un solo espacio'], ['cocina-estufa', 'Cocina con estufa']],
    costs: [['Agua', true, null], ['Mantenimiento', true, null], ['Luz', false, 1200], ['Internet', false, 450]],
  },
  {
    key: 'tec-estudio', landlord: 'rogelio', zone: 'tecnologico', title: 'Estudio amueblado con escritorio y cocineta',
    description: 'Estudio compacto en edificio con acceso controlado. Tiene cama matrimonial, escritorio y cocineta. A diez minutos a pie del campus.',
    kind: 'studio', rent: 11900, deposit: 1, minMonths: 5, semester: true, walk: 10, transit: 7, furnished: true, utilities: false, ac: true,
    address: 'Calle Demo 88, Col. Tecnológico, Monterrey', met: 'all',
    photos: [['estudio-cocineta', 'Estudio con sofá cama y cocineta'], ['cuarto-cama-escritorio', 'Cama individual junto al escritorio']],
    costs: [['Agua', true, null], ['Internet', true, null], ['Luz', false, 900]],
  },
  {
    key: 'tec-sospechoso', landlord: 'rogelio', zone: 'tecnologico', title: 'Depa amueblado económico muy cerca del Tec',
    description: 'Departamento amueblado con todos los servicios. Revisión de documentos en proceso; aún no se puede solicitar por la plataforma.',
    kind: 'apartment', rent: 6200, deposit: 2, minMonths: 12, semester: false, walk: 9, transit: 7, furnished: true, utilities: true, ac: true,
    address: 'Calle Demo 15, Col. Tecnológico, Monterrey', met: ['landlord_identity', 'dated_photos'],
    photos: [['depa-comedor', 'Departamento con comedor y cocina integral']],
    costs: [['Servicios', true, null]],
  },
  {
    key: 'alta-compartido', landlord: 'marcela', zone: 'altavista', title: 'Cuarto en casa de estudiantes con patio',
    description: 'Casa compartida con cuatro estudiantes en zona residencial. Cada quien tiene su cuarto y comparten cocina, sala y patio. Hay comunidad internacional.',
    kind: 'room', rent: 8200, deposit: 1, minMonths: 5, semester: true, walk: 18, transit: 11, furnished: true, utilities: true, ac: false,
    address: 'Privada Demo 33, Col. Altavista, Monterrey', met: 'all',
    photos: [['cuarto-dos-camas', 'Cuarto con ventana y dos camas'], ['cocina-compartida', 'Cocina compartida']],
    costs: [['Agua', true, null], ['Luz', true, null], ['Internet', true, null], ['Aire acondicionado', false, 500]],
  },
  {
    key: 'alta-depa', landlord: 'rogelio', zone: 'altavista', title: 'Departamento para dos con balcón',
    description: 'Dos recámaras y dos baños; puedes rentarlo con una roomie y dividir el costo. Estacionamiento techado y balcón. Sin amueblar la segunda recámara.',
    kind: 'apartment', rent: 17800, deposit: 1, minMonths: 6, semester: true, walk: 22, transit: 14, furnished: false, utilities: false, ac: true,
    address: 'Av. Demo 410, Col. Altavista, Monterrey', met: ['ownership_docs', 'landlord_identity', 'model_contract'],
    photos: [['depa-vacio', 'Departamento sin amueblar'], ['cocina-oscura', 'Cocina con estufa y horno de microondas']],
    costs: [['Mantenimiento', true, null], ['Luz', false, 1500], ['Internet', false, 450], ['Agua', false, 250]],
  },
  {
    key: 'alta-recamara', landlord: 'marcela', zone: 'altavista', title: 'Recámara amueblada con baño compartido',
    description: 'Recámara en departamento con otra estudiante. Baño compartido, cocina completa y lavadora. A una cuadra de la ruta de camión al campus.',
    kind: 'room', rent: 7900, deposit: 1, minMonths: 5, semester: true, walk: 20, transit: 12, furnished: true, utilities: false, ac: true,
    address: 'Calle Demo 77, Col. Altavista, Monterrey', met: 'all',
    photos: [['cuarto-residencia', 'Recámara con cama y escritorio de madera'], ['cocina-pequena', 'Cocina pequeña']],
    costs: [['Agua', true, null], ['Internet', true, null], ['Luz', false, 700]],
  },
  {
    key: 'contry-loft', landlord: 'rogelio', zone: 'contry', title: 'Loft con vista a la sierra',
    description: 'Loft en edificio con gimnasio y seguridad las 24 horas. Más lejos del campus, pero en una zona con supermercados y servicios cerca.',
    kind: 'studio', rent: 19500, deposit: 2, minMonths: 6, semester: true, walk: 45, transit: 22, furnished: true, utilities: false, ac: true,
    address: 'Av. Demo 900, Col. Contry, Monterrey', met: 'all',
    photos: [['loft-ventanales', 'Loft con ventanales']],
    costs: [['Gimnasio', true, null], ['Mantenimiento', true, null], ['Luz', false, 1400], ['Internet', false, 500]],
  },
  {
    key: 'contry-depa', landlord: 'marcela', zone: 'contry', title: 'Departamento familiar en planta baja',
    description: 'Dos recámaras en planta baja, con patio trasero. Admite contrato semestral. Hay transporte hacia el Tec en la avenida principal.',
    kind: 'apartment', rent: 16000, deposit: 1, minMonths: 5, semester: true, walk: 50, transit: 25, furnished: true, utilities: false, ac: true,
    address: 'Calle Demo 300, Col. Contry, Monterrey', met: 'all',
    photos: [['sala-sencilla', 'Sala con dos sillones'], ['cocina-barra', 'Cocina con barra']],
    costs: [['Agua', true, null], ['Luz', false, 1300], ['Internet', false, 450]],
  },
  {
    key: 'roma-residencia', landlord: 'rogelio', zone: 'roma', title: 'Lugar en residencia estudiantil con comedor',
    description: 'Cama en cuarto compartido dentro de residencia privada con comedor, sala de estudio y vigilancia. Ideal si llegas por primera vez y prefieres conocer gente desde el inicio.',
    kind: 'residence', rent: 7200, deposit: 1, minMonths: 5, semester: true, walk: 25, transit: 15, furnished: true, utilities: true, ac: true,
    address: 'Av. Demo 55, Col. Roma, Monterrey', met: 'all',
    photos: [['cuarto-literas', 'Cuarto compartido con literas'], ['comedor-residencia', 'Comedor de la residencia']],
    costs: [['Servicios', true, null], ['Comidas entre semana', true, null], ['Lavandería', false, 250]],
  },
  {
    key: 'roma-depa', landlord: 'marcela', zone: 'roma', title: 'Estudio remodelado con buena luz natural',
    description: 'Estudio remodelado en 2025, con cama, clóset y cocineta. Calle tranquila; caminas al transporte hacia el campus en cinco minutos.',
    kind: 'studio', rent: 10500, deposit: 1, minMonths: 5, semester: true, walk: 28, transit: 16, furnished: true, utilities: false, ac: true,
    address: 'Calle Demo 201, Col. Roma, Monterrey', met: ['ownership_docs', 'landlord_identity', 'dated_photos'],
    photos: [['estudio-buhardilla', 'Estudio con tragaluz y escritorio']],
    costs: [['Agua', true, null], ['Luz', false, 800], ['Internet', false, 400]],
  },
  {
    key: 'repueblo-cuarto', landlord: 'rogelio', zone: 'nuevo-repueblo', title: 'Cuarto sencillo en casa con dueña',
    description: 'Cuarto en casa donde vive la dueña, con desayuno opcional. La opción de menor costo si tu presupuesto es ajustado y no te molesta un trayecto más largo.',
    kind: 'room', rent: 6800, deposit: 1, minMonths: 5, semester: true, walk: 35, transit: 18, furnished: true, utilities: true, ac: false,
    address: 'Calle Demo 12, Col. Nuevo Repueblo, Monterrey', met: 'all',
    photos: [['cuarto-camas-claro', 'Cuarto claro con cama']],
    costs: [['Servicios', true, null], ['Desayuno', false, 800]],
  },
  {
    key: 'pendiente', landlord: 'marcela', zone: 'tecnologico', title: 'Cuarto nuevo esperando revisión',
    description: 'Cuarto recién publicado por su arrendadora. Sirve en la demostración para probar la revisión del administrador antes de que aparezca en la búsqueda.',
    kind: 'room', rent: 9200, deposit: 1, minMonths: 5, semester: true, walk: 11, transit: 8, furnished: true, utilities: false, ac: true,
    address: 'Calle Demo 45, Col. Tecnológico, Monterrey', met: [], status: 'pending_review',
    photos: [['cuarto-doble', 'Cuarto con dos camas individuales']],
    costs: [['Agua', true, null], ['Luz', false, 800]],
  },
]

const MENTORS = [
  {
    key: 'diego', name: 'Diego Treviño', email: 'diego', country: 'México', kind: 'local', university: 'Tec de Monterrey, Campus Monterrey', zone: 'tecnologico',
    headline: 'Regio de toda la vida; te explico cómo moverte sin coche',
    bio: 'Estudio Ingeniería en el Tec y he vivido siempre cerca del campus. He ayudado a varios intercambistas a elegir zona, abrir cuenta y entender las rutas de camión.',
    languages: ['Español', 'Inglés'], topics: ['Transporte', 'Zonas', 'Vida diaria'],
  },
  {
    key: 'ines', name: 'Inés Moreau', email: 'ines', country: 'Francia', kind: 'ex_exchange', university: 'Tec de Monterrey, Campus Monterrey', zone: 'altavista',
    headline: 'Vine de Lyon y me quedé: pregúntame lo que nadie te cuenta',
    bio: 'Hice mi intercambio en 2025 y viví en Altavista. Sé lo que es tramitar la visa, manejar tarjetas extranjeras y recibir el primer recibo de luz en agosto.',
    languages: ['Francés', 'Español', 'Inglés'], topics: ['Visa', 'Dinero', 'Vivienda', 'Cultura'],
  },
  {
    key: 'hyun', name: 'Hyun-woo Park', email: 'hyun', country: 'Corea del Sur', kind: 'ex_exchange', university: 'Tec de Monterrey, Campus Monterrey', zone: 'tecnologico',
    headline: 'Llegué sin hablar español; te ayudo a empezar',
    bio: 'Viví un año en la colonia Tecnológico. Puedo ayudarte con seguro médico, compras del día a día y cómo hacer amigos cuando todavía no hablas bien el idioma.',
    languages: ['Coreano', 'Inglés', 'Español'], topics: ['Salud', 'Cultura', 'Vida diaria'],
  },
  {
    key: 'renata', name: 'Renata Salazar', email: 'renata', country: 'México', kind: 'ex_exchange', university: 'Tec de Monterrey, Campus Monterrey', zone: 'roma',
    headline: 'Foránea de Sinaloa; sé cómo rendir el presupuesto',
    bio: 'Me mudé de Culiacán a Monterrey para estudiar. Comparé residencias y departamentos con un presupuesto limitado, y puedo enseñarte a hacer lo mismo.',
    languages: ['Español'], topics: ['Dinero', 'Vivienda', 'Zonas'],
  },
] as const

/** Idempotente: si ya existe la cuenta de admin de demo, no vuelve a sembrar. */
export async function seedDemo(db: Db): Promise<void> {
  const [exists] = await db.query(`SELECT 1 FROM users WHERE email = 'admin@demo.aterriza.mx'`)
  if (exists) return

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const addUser = async (email: string, name: string, role: string, extra: { country?: string; status?: string; matricula?: string } = {}) => {
    const [u] = await db.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, home_country, student_status, matricula, email_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`,
      [`${email}@demo.aterriza.mx`, passwordHash, name, role, extra.country ?? null, extra.status ?? 'none', extra.matricula ?? null],
    )
    return u!.id
  }

  const adminId = await addUser('admin', 'Equipo Aterriza', 'admin')
  const lucia = await addUser('lucia', 'Lucía Ferrer', 'student', { country: 'España', status: 'verified', matricula: 'A09000001' })
  const tomas = await addUser('tomas', 'Tomás Rivera', 'student', { country: 'Colombia', status: 'verified', matricula: 'A09000002' })
  const clara = await addUser('clara', 'Clara Weber', 'student', { country: 'Alemania', status: 'verified', matricula: 'A09000003' })
  const pendiente = await addUser('nadia', 'Nadia Haddad', 'student', { country: 'Marruecos', status: 'pending', matricula: 'A09000004' })
  await db.query(`INSERT INTO student_verifications (user_id, method, matricula, status) VALUES ($1,'manual','A09000004','pending')`, [pendiente])

  const landlords: Record<string, string> = {
    marcela: await addUser('marcela', 'Marcela Garza', 'landlord'),
    rogelio: await addUser('rogelio', 'Rogelio Cantú', 'landlord'),
  }

  const zones = await db.query<{ id: string; slug: string; lat: number; lng: number }>('SELECT id, slug, lat, lng FROM zones')
  const zoneOf = (slug: string) => zones.find((z) => z.slug === slug)!

  for (const m of MENTORS) {
    const id = await addUser(m.email, m.name, 'mentor', { country: m.country })
    await db.query(
      `INSERT INTO mentor_profiles (user_id, kind, university, headline, bio, languages, topics, zone_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved')`,
      [id, m.kind, m.university, m.headline, m.bio, [...m.languages], [...m.topics], zoneOf(m.zone).id],
    )
  }
  const pendingMentor = await addUser('sofia', 'Sofía Ibarra', 'mentor', { country: 'México' })
  await db.query(
    `INSERT INTO mentor_profiles (user_id, kind, university, headline, bio, languages, topics, zone_id, status)
     VALUES ($1,'local','Tec de Monterrey, Campus Monterrey','Te ayudo con tu primera semana en la ciudad','Estudio Medicina y conozco bien los servicios de salud alrededor del campus. Quiero ayudar a quienes llegan por primera vez.',$2,$3,$4,'pending')`,
    [pendingMentor, ['Español', 'Inglés'], ['Salud', 'Vida diaria'], zoneOf('tecnologico').id],
  )

  const listingIds: Record<string, string> = {}
  for (const l of LISTINGS) {
    const zone = zoneOf(l.zone)
    const c = approximateNear(zone.lat, zone.lng, l.key)
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO listings (landlord_id, zone_id, title, description, kind, monthly_rent_mxn, deposit_months, min_months, semester_contract,
         minutes_walk, minutes_transit, furnished, utilities_included, air_conditioning, approx_lat, approx_lng, exact_address, available_from, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'2027-01-05',$18) RETURNING id`,
      [landlords[l.landlord], zone.id, l.title, l.description, l.kind, l.rent, l.deposit, l.minMonths, l.semester, l.walk, l.transit, l.furnished, l.utilities, l.ac, c.lat, c.lng, l.address, l.status ?? 'active'],
    )
    const id = row!.id
    listingIds[l.key] = id
    for (const [i, [file, alt]] of l.photos.entries()) {
      await db.query('INSERT INTO listing_photos (listing_id, url, alt, position) VALUES ($1,$2,$3,$4)', [id, `/demo/${file}.jpg`, alt, i])
    }
    for (const [label, included, estimate] of l.costs) {
      await db.query('INSERT INTO listing_cost_items (listing_id, label, included, estimate_mxn) VALUES ($1,$2,$3,$4)', [id, label, included, estimate])
    }
    const met = l.met === 'all' ? CRITERIA : l.met
    for (const crit of CRITERIA) {
      await db.query(
        `INSERT INTO listing_criteria (listing_id, criterion, met, checked_by, checked_at) VALUES ($1,$2,$3,$4,$5)`,
        [id, crit, met.includes(crit), met.includes(crit) ? adminId : null, met.includes(crit) ? '2026-10-20T16:00:00Z' : null],
      )
    }
  }

  // Estancias pasadas: son el respaldo de las reseñas.
  const addStay = async (student: string, key: string, rating: number, comment: string, stay: string, status: 'completed' | 'reviewable' = 'completed') => {
    const [b] = await db.query<{ id: string }>(
      `INSERT INTO bookings (listing_id, student_id, status, start_date, end_date, message, fraud_notice_ack_at)
       VALUES ($1,$2,'completed','2026-01-10','2026-06-15','Estancia de demostración',now()) RETURNING id`,
      [listingIds[key], student],
    )
    await db.query(`INSERT INTO booking_events (booking_id, actor_id, from_status, to_status) VALUES ($1,$2,NULL,'completed')`, [b!.id, student])
    if (status === 'reviewable') return
    await db.query('INSERT INTO reviews (listing_id, booking_id, author_id, rating, comment, stay_label) VALUES ($1,$2,$3,$4,$5,$6)', [listingIds[key], b!.id, student, rating, comment, stay])
  }
  await addStay(tomas, 'roma-cuarto', 5, 'El contrato estaba listo antes de llegar y lo que decía el anuncio era verdad. Marcela me dio recibo cada mes, sin que se lo pidiera.', 'ene 2026 a jun 2026')
  await addStay(clara, 'roma-cuarto', 4, 'Muy cerca del campus y buena convivencia. En agosto hace calor aunque el aire funciona; pregunta si hay tope de luz antes de firmar.', 'ene 2026 a jun 2026')
  await addStay(clara, 'alta-compartido', 5, 'La casa tiene ambiente internacional y me ayudó a hacer amigos la primera semana. El camión al campus pasa a una cuadra.', 'ene 2026 a jun 2026')
  await addStay(tomas, 'roma-residencia', 4, 'Buena opción para llegar sin conocer a nadie. El comedor ahorra mucho tiempo; el cuarto compartido no da mucha privacidad.', 'ago 2025 a dic 2025')
  await addStay(tomas, 'contry-loft', 3, 'El lugar es muy bonito, pero el traslado al Tec en hora pico puede tardar el doble de lo que dice el mapa.', 'ago 2025 a dic 2025')
  // Lucía tiene una estancia sin reseñar para poder mostrar ese flujo.
  await addStay(lucia, 'alta-recamara', 0, '', '', 'reviewable')

  // Un chat de ejemplo con una señal de riesgo.
  const diego = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = 'diego@demo.aterriza.mx'`)
  const [conv] = await db.query<{ id: string }>(
    `INSERT INTO conversations (kind, student_id, counterpart_id, status, last_message_at) VALUES ('mentor',$1,$2,'active',now()) RETURNING id`,
    [lucia, diego[0]!.id],
  )
  const chat: [string, string][] = [
    [lucia, '¡Hola, Diego! Llego en enero. ¿Altavista o Tecnológico si no voy a tener coche?'],
    [diego[0]!.id, 'Hola, Lucía. Sin coche yo elegiría Tecnológico: caminas al campus y evitas depender del camión en horas pico.'],
    [lucia, 'Gracias. Vi un depa en Facebook mucho más barato y me piden transferencia para apartar, ¿es normal?'],
    [diego[0]!.id, 'No lo hagas sin verlo y sin contrato. Es justo como empiezan las estafas. Pídele una videollamada y revisa si está verificado aquí.'],
  ]
  for (const [sender, body] of chat) {
    await db.query('INSERT INTO messages (conversation_id, sender_id, body, risk_flags, read_at) VALUES ($1,$2,$3,$4,now())', [conv!.id, sender, body, detectScamSignals(body)])
  }

  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,'demo','Bienvenida a Aterriza','Sigue tu checklist para llegar con todo resuelto.','/checklist')`,
    [lucia],
  )
}
