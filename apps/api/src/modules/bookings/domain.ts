/** Máquina de estados y reglas de solicitud. Sin dependencias externas. */
import type { BookingAction, BookingStatus, VerificationLevel } from '@aterriza/contracts'

export type BookingParty = 'student' | 'landlord' | 'admin'

interface Transition {
  to: BookingStatus
  by: readonly BookingParty[]
}

/** State: lo que no está en esta tabla no se puede hacer. */
export const BOOKING_MACHINE: Record<BookingStatus, Partial<Record<BookingAction, Transition>>> = {
  requested: {
    schedule_tour: { to: 'tour_scheduled', by: ['landlord'] },
    accept: { to: 'accepted', by: ['landlord'] },
    reject: { to: 'rejected', by: ['landlord'] },
    cancel: { to: 'cancelled', by: ['student'] },
  },
  tour_scheduled: {
    schedule_tour: { to: 'tour_scheduled', by: ['landlord'] },
    accept: { to: 'accepted', by: ['landlord'] },
    reject: { to: 'rejected', by: ['landlord'] },
    cancel: { to: 'cancelled', by: ['student'] },
  },
  accepted: {
    confirm: { to: 'confirmed', by: ['student'] },
    cancel: { to: 'cancelled', by: ['student', 'landlord'] },
  },
  confirmed: {
    complete: { to: 'completed', by: ['landlord', 'admin'] },
  },
  completed: {},
  rejected: {},
  cancelled: {},
}

export function nextStatus(status: BookingStatus, action: BookingAction, party: BookingParty): BookingStatus | null {
  const t = BOOKING_MACHINE[status][action]
  return t && t.by.includes(party) ? t.to : null
}

export function allowedActions(status: BookingStatus, party: BookingParty): BookingAction[] {
  return (Object.entries(BOOKING_MACHINE[status]) as [BookingAction, Transition][])
    .filter(([, t]) => t.by.includes(party))
    .map(([action]) => action)
}

export const ADDRESS_VISIBLE: readonly BookingStatus[] = ['accepted', 'confirmed', 'completed']
export const ACTIVE_STATUSES: readonly BookingStatus[] = ['requested', 'tour_scheduled', 'accepted', 'confirmed']

// ---------- Reglas para solicitar ----------
export interface BookingContext {
  listingStatus: string
  level: VerificationLevel
  occupied: boolean
  isOwner: boolean
  actorRole: string
  studentValidated: boolean
  hasActiveBooking: boolean
  minMonths: number
  startDate: string
  endDate: string
  today: string
  fraudNoticeAck: boolean
}

export interface BookingRule {
  check(c: BookingContext): string | null
}

const months = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / (1000 * 60 * 60 * 24 * 30.44)

const rule = (check: BookingRule['check']): BookingRule => ({ check })

/** Se evalúan todas para decir de una vez todo lo que falta. */
export const BOOKING_RULES: readonly BookingRule[] = [
  rule((c) => (c.actorRole === 'student' ? null : 'Solo las cuentas de estudiante pueden solicitar vivienda.')),
  rule((c) => (c.studentValidated ? null : 'Valida tu matrícula para solicitar una vivienda.')),
  rule((c) => (c.isOwner ? 'No puedes solicitar tu propia vivienda.' : null)),
  rule((c) => (c.listingStatus === 'active' ? null : 'Esta vivienda no está disponible en este momento.')),
  rule((c) => (c.level === 'verified' ? null : 'Esta vivienda aún no tiene las 4 revisiones que pedimos para poder solicitarla.')),
  rule((c) => (c.occupied ? 'Esta vivienda está ocupada en este momento.' : null)),
  rule((c) => (c.hasActiveBooking ? 'Ya tienes una solicitud activa para esta vivienda.' : null)),
  rule((c) => (c.fraudNoticeAck ? null : 'Confirma que leíste el aviso sobre pagos.')),
  rule((c) => (c.startDate < c.today ? 'La fecha de entrada ya pasó.' : null)),
  rule((c) => (c.endDate <= c.startDate ? 'La fecha de salida debe ser posterior a la de entrada.' : null)),
  rule((c) =>
    c.endDate > c.startDate && months(c.startDate, c.endDate) < c.minMonths - 0.25
      ? `Esta vivienda pide un plazo mínimo de ${c.minMonths} meses.`
      : null,
  ),
]

/** Reglas sin datos de una solicitud: sirven para avisar en la ficha antes de llenar el formulario. */
export function evaluateBooking(c: BookingContext, rules: readonly BookingRule[] = BOOKING_RULES): string[] {
  return rules.map((r) => r.check(c)).filter((v): v is string => v !== null)
}
