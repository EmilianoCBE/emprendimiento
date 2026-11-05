import type { BookingAction, BookingStatus, ListingKind, ListingStatus, MentorKind, VerificationLevel } from '@aterriza/contracts'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const money = (n: number) => mxn.format(n)

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const dateOnly = (iso: string) => dateFmt.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso))
export const dateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
export const shortDateTime = (iso: string) => shortFmt.format(new Date(iso))

export const KIND_LABEL: Record<ListingKind, string> = { room: 'Cuarto', studio: 'Estudio', apartment: 'Departamento', residence: 'Residencia' }
export const LEVEL_LABEL: Record<VerificationLevel, string> = { verified: 'Verificada', partial: 'Revisión parcial', unverified: 'Sin revisar' }
export const MENTOR_KIND_LABEL: Record<MentorKind, string> = { local: 'Estudiante local', ex_exchange: 'Ya vivió el cambio' }

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Solicitud enviada',
  tour_scheduled: 'Videollamada agendada',
  accepted: 'Aceptada',
  confirmed: 'Contrato confirmado',
  completed: 'Estancia concluida',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}
export const ACTION_LABEL: Record<BookingAction, string> = {
  schedule_tour: 'Agendar videollamada',
  accept: 'Aceptar solicitud',
  reject: 'Rechazar',
  cancel: 'Cancelar solicitud',
  confirm: 'Ya firmé el contrato',
  complete: 'Marcar estancia concluida',
}
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  active: 'Publicada',
  under_review: 'En revisión por reportes',
  archived: 'Archivada',
}
export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
