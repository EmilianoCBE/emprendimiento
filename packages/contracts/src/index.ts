/**
 * Contratos compartidos entre API y web: una sola definición de lo que entra
 * (esquemas zod) y lo que sale (tipos). zod descarta campos no declarados, lo
 * que impide, por ejemplo, enviar `role: "admin"` al actualizar un perfil.
 */
import { z } from 'zod'

// ---------- Valores cerrados ----------
export const ROLES = ['student', 'mentor', 'landlord', 'admin'] as const
export type Role = (typeof ROLES)[number]
export const PUBLIC_ROLES = ['student', 'mentor', 'landlord'] as const

export type StudentStatus = 'none' | 'pending' | 'verified' | 'rejected'

export const LISTING_KINDS = ['room', 'studio', 'apartment', 'residence'] as const
export type ListingKind = (typeof LISTING_KINDS)[number]
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'under_review' | 'archived'

export const CRITERIA = ['ownership_docs', 'landlord_identity', 'model_contract', 'dated_photos'] as const
export type Criterion = (typeof CRITERIA)[number]
export type VerificationLevel = 'verified' | 'partial' | 'unverified'

export const BOOKING_ACTIONS = ['schedule_tour', 'accept', 'reject', 'cancel', 'confirm', 'complete'] as const
export type BookingAction = (typeof BOOKING_ACTIONS)[number]
export type BookingStatus =
  | 'requested'
  | 'tour_scheduled'
  | 'accepted'
  | 'confirmed'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export const BOOKING_STEPS = ['passport', 'offer_letter', 'guarantee', 'contract_read', 'deposit_receipt'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]
export const BOOKING_STEP_LABEL: Record<BookingStep, { title: string; hint: string }> = {
  passport: { title: 'Identificación o pasaporte a la mano', hint: 'Solo la muestras al firmar. Aterriza no la guarda.' },
  offer_letter: { title: 'Carta de aceptación de tu universidad', hint: 'Evita pagar antes de saber que te aceptaron.' },
  guarantee: { title: 'Acuerdo sobre aval o depósito', hint: 'Pregunta si piden aval local o qué alternativa aceptan.' },
  contract_read: { title: 'Contrato leído, con lo que incluye la renta', hint: 'Fechas, servicios, límites de consumo y salida anticipada.' },
  deposit_receipt: { title: 'Recibo de tu depósito', hint: 'Si pagas después de firmar, guarda siempre el recibo.' },
}

export const REPORT_REASONS = ['fake_listing', 'asked_prepayment', 'changed_conditions', 'no_receipt', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const MENTOR_KINDS = ['local', 'ex_exchange'] as const
export type MentorKind = (typeof MENTOR_KINDS)[number]

export const SORTS = ['trust', 'price_asc', 'price_desc', 'distance'] as const
export type ListingSort = (typeof SORTS)[number]

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  fake_listing: 'El anuncio parece falso o la vivienda no existe',
  asked_prepayment: 'Me pidió pagar antes de ver el lugar',
  changed_conditions: 'Cambió las condiciones acordadas',
  no_receipt: 'No entrega recibos de pago',
  other: 'Otro motivo',
}

export const CRITERION_LABEL: Record<Criterion, { title: string; detail: string }> = {
  ownership_docs: { title: 'Documentos de propiedad', detail: 'Revisamos que quien renta tiene derecho a hacerlo.' },
  landlord_identity: { title: 'Identidad del arrendador', detail: 'Comprobamos con identificación oficial quién publica.' },
  model_contract: { title: 'Contrato por escrito y recibos', detail: 'Acepta firmar contrato y entregar recibo por cada pago.' },
  dated_photos: { title: 'Fotos con fecha', detail: 'Las fotos corresponden al lugar y tienen fecha comprobable.' },
}

// ---------- Campos comunes ----------
const email = z.string().trim().toLowerCase().email('Escribe un correo válido.').max(254)
const password = z.string().min(10, 'Usa al menos 10 caracteres.').max(128, 'Usa máximo 128 caracteres.')
const code = z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos.')
const shortText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: escribe al menos ${min} caracteres.`)
    .max(max, `${label}: máximo ${max} caracteres.`)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida.')
const queryBool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional())

export const uuidSchema = z.string().uuid()

// ---------- Identidad ----------
export const registerSchema = z.object({
  email,
  password,
  fullName: shortText(2, 80, 'Nombre'),
  role: z.enum(PUBLIC_ROLES),
  homeCountry: z.string().trim().max(60).optional(),
})
export const verifyEmailSchema = z.object({ email, code })
export const emailOnlySchema = z.object({ email })
export const loginSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña.').max(128) })
export const resetPasswordSchema = z.object({ email, code, password })
export const updateMeSchema = z.object({
  fullName: shortText(2, 80, 'Nombre').optional(),
  homeCountry: z.string().trim().max(60).nullable().optional(),
})
export const deleteMeSchema = z.object({ password: z.string().min(1).max(128) })
export const studentVerificationSchema = z.object({
  matricula: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^A\d{8}$/, 'La matrícula tiene el formato A01234567.'),
})

// ---------- Viviendas ----------
export const listingQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  zone: z.string().trim().max(60).optional(),
  kind: z.enum(LISTING_KINDS).optional(),
  maxRent: z.coerce.number().int().positive().max(200_000).optional(),
  maxMinutes: z.coerce.number().int().positive().max(180).optional(),
  furnished: queryBool,
  utilities: queryBool,
  semester: queryBool,
  verifiedOnly: queryBool,
  sort: z.enum(SORTS).default('trust'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
})
export type ListingQuery = z.infer<typeof listingQuerySchema>

const costItemSchema = z.object({
  label: shortText(2, 60, 'Concepto'),
  included: z.boolean(),
  estimateMxn: z.number().int().min(0).max(100_000).nullable().optional(),
})

export const listingInputSchema = z.object({
  zoneId: uuidSchema,
  title: shortText(8, 90, 'Título'),
  description: shortText(30, 2000, 'Descripción'),
  kind: z.enum(LISTING_KINDS),
  monthlyRentMxn: z.number().int().min(500).max(200_000),
  depositMonths: z.number().min(0).max(6),
  minMonths: z.number().int().min(1).max(24),
  semesterContract: z.boolean(),
  minutesWalk: z.number().int().min(0).max(240),
  minutesTransit: z.number().int().min(0).max(240),
  furnished: z.boolean(),
  utilitiesIncluded: z.boolean(),
  airConditioning: z.boolean(),
  exactAddress: shortText(8, 200, 'Dirección'),
  availableFrom: isoDate,
  costItems: z.array(costItemSchema).max(20).default([]),
})
export type ListingInput = z.infer<typeof listingInputSchema>

// ---------- Solicitudes ----------
export const createBookingSchema = z.object({
  listingId: uuidSchema,
  startDate: isoDate,
  endDate: isoDate,
  message: shortText(10, 800, 'Mensaje'),
  fraudNoticeAck: z.boolean(),
})
export const bookingTransitionSchema = z.object({
  action: z.enum(BOOKING_ACTIONS),
  tourAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(400).optional(),
})

export const bookingStepSchema = z.object({ done: z.boolean() })

// ---------- Confianza ----------
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: shortText(20, 600, 'Comentario'),
})
export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().max(600).optional(),
})

// ---------- Comunidad ----------
export const mentorQuerySchema = z.object({
  kind: z.enum(MENTOR_KINDS).optional(),
  language: z.string().trim().max(30).optional(),
  topic: z.string().trim().max(40).optional(),
  zone: z.string().trim().max(60).optional(),
})
export const mentorProfileSchema = z.object({
  kind: z.enum(MENTOR_KINDS),
  university: shortText(2, 80, 'Universidad'),
  headline: shortText(10, 120, 'Presentación breve'),
  bio: shortText(30, 1000, 'Sobre ti'),
  languages: z.array(z.string().trim().min(2).max(30)).min(1).max(6),
  topics: z.array(z.string().trim().min(2).max(40)).min(1).max(8),
  zoneId: uuidSchema.nullable().optional(),
  accepting: z.boolean().default(true),
})
export const connectSchema = z.object({ intro: shortText(10, 500, 'Mensaje') })
export const messageSchema = z.object({ body: shortText(1, 2000, 'Mensaje') })
export const respondSchema = z.object({ accept: z.boolean() })

// ---------- Planeación ----------
export const budgetSchema = z.object({
  listingId: uuidSchema.optional(),
  monthlyRent: z.number().int().min(0).max(200_000).optional(),
  depositMonths: z.number().min(0).max(6).optional(),
  utilitiesIncluded: z.boolean().optional(),
  minutesTransit: z.number().int().min(0).max(240).optional(),
  arrivalMonth: z.number().int().min(1).max(12),
  usesAc: z.boolean(),
  international: z.boolean(),
})
export type BudgetInput = z.infer<typeof budgetSchema>
export const checklistSchema = z.object({ done: z.boolean() })

// ---------- Administración ----------
export const criteriaUpdateSchema = z.object({
  criteria: z.object({
    ownership_docs: z.boolean(),
    landlord_identity: z.boolean(),
    model_contract: z.boolean(),
    dated_photos: z.boolean(),
  }),
})
export const listingDecisionSchema = z.object({
  decision: z.enum(['approve', 'return', 'archive']),
  note: z.string().trim().max(400).optional(),
})
export const reportResolutionSchema = z.object({ decision: z.enum(['dismiss', 'uphold']) })
export const approvalSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(400).optional() })

// ---------- Respuestas ----------
export interface ApiErrorBody {
  error: { code: string; message: string; details?: string[]; requestId?: string }
}
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface PublicConfig {
  demoMode: boolean
  /** Solo existe en modo demo; ese modo no puede arrancar en producción. */
  demoPassword?: string
  /** Falso en la demo en línea: sus instancias no comparten disco. */
  uploadsEnabled: boolean
  institutionalDomains: string[]
}
export interface Me {
  id: string
  email: string
  fullName: string
  role: Role
  homeCountry: string | null
  studentStatus: StudentStatus
  matricula: string | null
  emailVerified: boolean
}
/** `devCode` solo existe en modo demo. */
export interface CodeSentResponse {
  ok: true
  devCode?: string
}
export interface Zone {
  id: string
  slug: string
  name: string
  lat: number
  lng: number
  transitNote: string
  lifeNote: string
  medianRentMxn: number | null
  listingCount: number
}
export interface PriceAlert {
  severity: 'warning' | 'danger'
  percentBelow: number
  medianMxn: number
  scope: 'zone' | 'city'
  message: string
}
export interface VerificationSummary {
  level: VerificationLevel
  metCount: number
  criteria: { id: Criterion; met: boolean; checkedAt: string | null }[]
}
export interface ListingCard {
  id: string
  title: string
  kind: ListingKind
  zoneName: string
  zoneSlug: string
  monthlyRentMxn: number
  estimatedMonthlyMxn: number
  depositMonths: number
  minutesWalk: number
  minutesTransit: number
  furnished: boolean
  utilitiesIncluded: boolean
  semesterContract: boolean
  approxLat: number
  approxLng: number
  photo: { url: string; alt: string } | null
  metCount: number
  level: VerificationLevel
  priceAlert: PriceAlert | null
  rating: number | null
  reviewCount: number
}
export interface Review {
  id: string
  rating: number
  comment: string
  stayLabel: string
  authorName: string
  createdAt: string
}
export interface MentorCard {
  id: string
  fullName: string
  kind: MentorKind
  university: string
  headline: string
  bio: string
  languages: string[]
  topics: string[]
  zoneName: string | null
  zoneSlug: string | null
  homeCountry: string | null
  accepting: boolean
}
export interface CostLine {
  id: string
  label: string
  amountMxn: number
  note?: string
  source: 'listing' | 'estimate'
  firstMonthOnly: boolean
}
export interface BudgetEstimate {
  lines: CostLine[]
  firstMonthTotalMxn: number
  typicalMonthTotalMxn: number
  estimatedShareMxn: number
  alerts: { id: string; title: string; detail: string }[]
}
export interface ListingDetail extends Omit<ListingCard, 'photo'> {
  description: string
  status: ListingStatus
  minMonths: number
  airConditioning: boolean
  availableFrom: string
  occupied: boolean
  photos: { id: string; url: string; alt: string }[]
  costItems: { label: string; included: boolean; estimateMxn: number | null }[]
  verification: VerificationSummary
  reviews: Review[]
  mentors: MentorCard[]
  budget: BudgetEstimate
  landlordName: string
  landlordId: string
  /** Solo para el dueño, un admin o el estudiante con solicitud aceptada. */
  exactAddress: string | null
  viewer: {
    isOwner: boolean
    activeBookingId: string | null
    canReview: boolean
    hasReported: boolean
    blockers: string[]
  }
}
export interface OwnedListing {
  id: string
  title: string
  status: ListingStatus
  monthlyRentMxn: number
  zoneName: string
  metCount: number
  level: VerificationLevel
  reviewNote: string | null
  photoCount: number
  pendingBookings: number
  photo: { url: string; alt: string } | null
  input: ListingInput
  photos: { id: string; url: string; alt: string }[]
  criteria: VerificationSummary['criteria']
}
export interface Booking {
  id: string
  status: BookingStatus
  startDate: string
  endDate: string
  message: string
  tourAt: string | null
  createdAt: string
  listing: { id: string; title: string; zoneName: string; monthlyRentMxn: number; photo: { url: string; alt: string } | null }
  studentName: string
  landlordName: string
  exactAddress: string | null
  conversationId: string | null
  /** Código corto para referirse a la solicitud. */
  reference: string
  steps: { id: BookingStep; done: boolean }[]
  allowedActions: BookingAction[]
  canReview: boolean
  events: { id: string; fromStatus: BookingStatus | null; toStatus: BookingStatus; note: string | null; createdAt: string; actorName: string }[]
}
export interface Conversation {
  id: string
  kind: 'mentor' | 'booking'
  status: 'pending' | 'active' | 'declined' | 'closed'
  intro: string | null
  otherName: string
  otherSubtitle: string | null
  iAmStudent: boolean
  lastMessageAt: string | null
  lastMessage: string | null
  unread: number
  listingTitle: string | null
}
export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  body: string
  riskFlags: { id: string; label: string }[]
  createdAt: string
}
export interface Guide {
  id: string
  slug: string
  category: string
  title: string
  summary: string
  body: string
  reviewedOn: string
}
export interface ChecklistItem {
  id: string
  phase: 'before' | 'week1'
  title: string
  hint: string
  done: boolean
}
export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}
export interface AdminMetrics {
  users: number
  validatedStudents: number
  activeListings: number
  verifiedListings: number
  pendingListings: number
  openReports: number
  bookings: number
  conversations: number
  flaggedMessages: number
}
export interface AdminQueueItem {
  id: string
  title: string
  status: ListingStatus
  zoneName: string
  landlordName: string
  monthlyRentMxn: number
  reviewNote: string | null
  reportCount: number
  photo: { url: string; alt: string } | null
  priceAlert: PriceAlert | null
  criteria: VerificationSummary['criteria']
}
export interface AdminReport {
  id: string
  listingId: string
  listingTitle: string
  listingStatus: ListingStatus
  reason: ReportReason
  detail: string | null
  reporterName: string
  createdAt: string
}
export interface PendingStudent {
  id: string
  fullName: string
  email: string
  matricula: string
  homeCountry: string | null
  requestedAt: string
}
export interface PendingMentor extends MentorCard {
  email: string
}
export interface AuditEntry {
  id: string
  actorName: string | null
  action: string
  entity: string
  entityId: string | null
  createdAt: string
}
