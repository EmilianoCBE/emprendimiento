import './admin.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { CRITERIA, CRITERION_LABEL, REPORT_REASON_LABEL, type AdminMetrics, type AdminQueueItem, type AdminReport, type AuditEntry, type Criterion, type Paged, type PendingMentor, type PendingStudent } from '@aterriza/contracts'
import { Button, ConfirmButton, Empty, ErrorNote, Loading, Note, Page, PriceAlertNote, TextInput, Toggle } from '../design/ui'
import { api } from '../lib/api'
import { LISTING_STATUS_LABEL, MENTOR_KIND_LABEL, money, shortDateTime } from '../lib/format'
import { useToast } from '../lib/toast'

export function AdminPage() {
  return (
    <Page title="Administración">
      <nav className="tabs" aria-label="Secciones de administración">
        <NavLink end to="/admin">Hoy</NavLink>
        <NavLink to="/admin/viviendas">Viviendas</NavLink>
        <NavLink to="/admin/reportes">Reportes</NavLink>
        <NavLink to="/admin/estudiantes">Estudiantes</NavLink>
        <NavLink to="/admin/mentores">Mentores</NavLink>
        <NavLink to="/admin/bitacora">Bitácora</NavLink>
      </nav>
      <Routes>
        <Route index element={<Summary />} />
        <Route path="viviendas" element={<Queue />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="estudiantes" element={<Students />} />
        <Route path="mentores" element={<Mentors />} />
        <Route path="bitacora" element={<Audit />} />
      </Routes>
    </Page>
  )
}

function Summary() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['admin-metrics'], queryFn: () => api.get<AdminMetrics>('/admin/metrics') })
  const students = useQuery({ queryKey: ['admin-students'], queryFn: () => api.get<PendingStudent[]>('/admin/students/pending') })
  const mentors = useQuery({ queryKey: ['admin-mentors'], queryFn: () => api.get<PendingMentor[]>('/admin/mentors/pending') })
  if (isLoading) return <Loading />
  if (!data) return <ErrorNote error={error} onRetry={() => void refetch()} />
  const todo: [string, string, number][] = [
    ['Viviendas por revisar', '/admin/viviendas', data.pendingListings],
    ['Reportes abiertos', '/admin/reportes', data.openReports],
    ['Matrículas por validar', '/admin/estudiantes', students.data?.length ?? 0],
    ['Mentores por aprobar', '/admin/mentores', mentors.data?.length ?? 0],
  ]
  const activity: [string, number][] = [
    ['Viviendas públicas', data.activeListings],
    ['Con 4 revisiones', data.verifiedListings],
    ['Personas registradas', data.users],
    ['Estudiantes validados', data.validatedStudents],
    ['Solicitudes', data.bookings],
    ['Conversaciones', data.conversations],
    ['Mensajes con señal de riesgo', data.flaggedMessages],
  ]
  return (
    <div className="stack stack--lg">
      <section>
        <h2 className="mb-3">Lo que te toca hoy</h2>
        <div className="todo-list">
          {todo.map(([label, to, n]) => (
            <Link key={to} to={to} className={`todo ${n > 0 ? 'has-work' : ''}`}>
              <span>{label}</span>
              <span className="figure todo__n">{n}</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3">Actividad</h2>
        <div className="stats">
          {activity.map(([label, n]) => (
            <div key={label}>
              <p className="figure stat__n">{n}</p>
              <p className="stat__l">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const MIN_TO_APPROVE = 2
const DECISION_DONE = { approve: 'Vivienda aprobada', return: 'Devuelta al arrendador', archive: 'Vivienda archivada' } as const

function QueueItem({ item }: { item: AdminQueueItem }) {
  const client = useQueryClient()
  const [marks, setMarks] = useState<Record<Criterion, boolean>>(() => Object.fromEntries(item.criteria.map((c) => [c.id, c.met])) as Record<Criterion, boolean>)
  const [note, setNote] = useState('')
  const toast = useToast()
  useEffect(() => {
    setMarks(Object.fromEntries(item.criteria.map((c) => [c.id, c.met])) as Record<Criterion, boolean>)
  }, [item.criteria])
  const decide = useMutation({
    mutationFn: async (decision: 'approve' | 'return' | 'archive') => {
      await api.put(`/admin/listings/${item.id}/criteria`, { criteria: marks })
      await api.post(`/admin/listings/${item.id}/decision`, { decision, note: note || undefined })
    },
    onSuccess: (_, decision) => {
      toast(`${DECISION_DONE[decision]}: ${item.title}`)
      void client.invalidateQueries({ queryKey: ['admin-queue'] })
      void client.invalidateQueries({ queryKey: ['listings'] })
    },
  })
  // El servidor no aprueba con menos de 2 revisiones: el botón lo dice antes (heurística 5).
  const marked = Object.values(marks).filter(Boolean).length
  const missingToApprove = Math.max(0, MIN_TO_APPROVE - marked)
  return (
    <article className="review-item">
      {item.photo ? <img src={item.photo.url} alt={item.photo.alt} /> : <div className="rowcard__ph" />}
      <div className="stack stack--tight">
        <h3><Link to={`/viviendas/${item.id}`}>{item.title}</Link></h3>
        <p className="muted small">{item.zoneName}, {money(item.monthlyRentMxn)} al mes, publicada por {item.landlordName}</p>
        <div className="chips">
          <span className="chip chip--wait">{LISTING_STATUS_LABEL[item.status]}</span>
          {item.reportCount > 0 && <span className="chip chip--stop">{item.reportCount} {item.reportCount === 1 ? 'reporte' : 'reportes'}</span>}
        </div>
        {item.priceAlert && <PriceAlertNote alert={item.priceAlert} />}
        <TextInput label="Nota para el arrendador (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
      </div>
      <div className="stack stack--tight">
        {CRITERIA.map((c) => (
          <Toggle key={c} label={CRITERION_LABEL[c].title} checked={marks[c]} onChange={(e) => setMarks({ ...marks, [c]: e.target.checked })} />
        ))}
        <ErrorNote error={decide.error} />
        <p className="small muted" aria-live="polite">
          {marked} de 4 revisiones marcadas.
          {missingToApprove > 0 ? ` Marca ${missingToApprove === 1 ? '1 más' : `${missingToApprove} más`} para poder aprobar.` : marked < 4 ? ' Se publicará, pero no se podrá solicitar.' : ''}
        </p>
        <div className="btnrow">
          <Button busy={decide.isPending && decide.variables === 'approve'} disabled={missingToApprove > 0 || decide.isPending} onClick={() => decide.mutate('approve')}>Aprobar</Button>
          <Button variant="secondary" busy={decide.isPending && decide.variables === 'return'} disabled={decide.isPending} onClick={() => decide.mutate('return')}>Devolver</Button>
          <ConfirmButton question="Deja de mostrarse." confirmLabel="Sí, archivar" busy={decide.isPending && decide.variables === 'archive'} disabled={decide.isPending} onConfirm={() => decide.mutate('archive')}>Archivar</ConfirmButton>
        </div>
      </div>
    </article>
  )
}

function Queue() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-queue'], queryFn: () => api.get<AdminQueueItem[]>('/admin/listings/queue') })
  return (
    <div className="stack">
      <h2 className="sr-only">Viviendas en revisión</h2>
      <Note title="Marca solo lo que comprobaste">
        El sello solo vale lo que valga esta revisión. Con menos de 2 revisiones no se puede aprobar; con menos de 4 se publica pero no se puede solicitar.
      </Note>
      <ErrorNote error={error} onRetry={() => void refetch()} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay viviendas por revisar"><p className="empty__body">Las nuevas aparecerán aquí cuando un arrendador las envíe.</p></Empty>}
      {data?.map((i) => <QueueItem key={i.id} item={i} />)}
    </div>
  )
}

function Reports() {
  const client = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.get<AdminReport[]>('/admin/reports') })
  const resolve = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'dismiss' | 'uphold' }) => api.post(`/admin/reports/${id}/resolve`, { decision }),
    onSuccess: (_, { decision }) => {
      toast(decision === 'uphold' ? 'Reporte confirmado y vivienda archivada' : 'Reporte desestimado')
      void client.invalidateQueries({ queryKey: ['admin-reports'] })
    },
  })
  return (
    <div className="stack">
      <h2 className="sr-only">Reportes abiertos</h2>
      <ErrorNote error={error ?? resolve.error} onRetry={error ? () => void refetch() : undefined} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay reportes abiertos"><p className="empty__body">Los reportes de estudiantes aparecerán aquí.</p></Empty>}
      {data?.map((r) => (
        <article key={r.id} className="panel stack stack--tight">
          <h3><Link to={`/viviendas/${r.listingId}`}>{r.listingTitle}</Link></h3>
          <p><b>{REPORT_REASON_LABEL[r.reason]}</b></p>
          {r.detail && <p>{r.detail}</p>}
          <p className="small muted">{r.reporterName}, {shortDateTime(r.createdAt)}. Estado de la vivienda: {LISTING_STATUS_LABEL[r.listingStatus]}.</p>
          <div className="btnrow">
            <ConfirmButton question="La vivienda deja de mostrarse." confirmLabel="Sí, archivar" busy={resolve.isPending && resolve.variables?.id === r.id} onConfirm={() => resolve.mutate({ id: r.id, decision: 'uphold' })}>Confirmar y archivar vivienda</ConfirmButton>
            <Button variant="secondary" busy={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, decision: 'dismiss' })}>Desestimar</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Students() {
  const client = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-students'], queryFn: () => api.get<PendingStudent[]>('/admin/students/pending') })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/admin/students/${id}/decision`, { approve }),
    onSuccess: (_, { approve }) => {
      toast(approve ? 'Matrícula validada' : 'Matrícula rechazada')
      void client.invalidateQueries({ queryKey: ['admin-students'] })
    },
  })
  return (
    <div className="stack">
      <h2 className="sr-only">Matrículas por validar</h2>
      <ErrorNote error={error ?? decide.error} onRetry={error ? () => void refetch() : undefined} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay matrículas por revisar"><p className="empty__body">Aquí llegan quienes no tienen correo institucional.</p></Empty>}
      {data?.map((s) => (
        <article key={s.id} className="panel stack stack--tight">
          <h3>{s.fullName}</h3>
          <p className="small muted">{s.email}{s.homeCountry ? `, ${s.homeCountry}` : ''}</p>
          <p>Matrícula: <b>{s.matricula}</b></p>
          <div className="btnrow">
            <Button busy={decide.isPending && decide.variables?.id === s.id && decide.variables.approve} onClick={() => decide.mutate({ id: s.id, approve: true })}>Validar</Button>
            <ConfirmButton confirmLabel="Sí, rechazar" busy={decide.isPending && decide.variables?.id === s.id && !decide.variables.approve} onConfirm={() => decide.mutate({ id: s.id, approve: false })}>Rechazar</ConfirmButton>
          </div>
        </article>
      ))}
    </div>
  )
}

function Mentors() {
  const client = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-mentors'], queryFn: () => api.get<PendingMentor[]>('/admin/mentors/pending') })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/admin/mentors/${id}/decision`, { approve }),
    onSuccess: (_, { approve }) => {
      toast(approve ? 'Perfil aprobado: ya es público' : 'Perfil rechazado')
      void client.invalidateQueries({ queryKey: ['admin-mentors'] })
    },
  })
  return (
    <div className="stack">
      <h2 className="sr-only">Perfiles por aprobar</h2>
      <ErrorNote error={error ?? decide.error} onRetry={error ? () => void refetch() : undefined} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay perfiles por aprobar"><p className="empty__body">Los perfiles nuevos de mentores aparecerán aquí.</p></Empty>}
      {data?.map((m) => (
        <article key={m.id} className="panel stack stack--tight">
          <h3>{m.fullName}</h3>
          <p className="small muted">{MENTOR_KIND_LABEL[m.kind]}, {m.university}. {m.email}</p>
          <p><b>{m.headline}</b></p>
          <p>{m.bio}</p>
          <div className="btnrow">
            <Button busy={decide.isPending && decide.variables?.id === m.id && decide.variables.approve} onClick={() => decide.mutate({ id: m.id, approve: true })}>Aprobar perfil</Button>
            <ConfirmButton confirmLabel="Sí, rechazar" busy={decide.isPending && decide.variables?.id === m.id && !decide.variables.approve} onConfirm={() => decide.mutate({ id: m.id, approve: false })}>Rechazar</ConfirmButton>
          </div>
        </article>
      ))}
    </div>
  )
}

/** La bitácora se lee en frases, no en códigos internos (heurística 2). */
const AUDIT_ACTION: Record<string, string> = {
  'booking.requested': 'Solicitó una vivienda',
  'booking.changed': 'Cambió el estado de una solicitud',
  'booking.schedule_tour': 'Agendó una videollamada',
  'booking.accept': 'Aceptó una solicitud',
  'booking.reject': 'Rechazó una solicitud',
  'booking.cancel': 'Canceló una solicitud',
  'booking.confirm': 'Confirmó el contrato',
  'booking.complete': 'Concluyó una estancia',
  'listing.approve': 'Aprobó una vivienda',
  'listing.return': 'Devolvió una vivienda al arrendador',
  'listing.archive': 'Archivó una vivienda',
  'report.uphold': 'Confirmó un reporte',
  'report.dismiss': 'Desestimó un reporte',
  'connection.requested': 'Pidió hablar con un mentor',
  'connection.answered': 'Respondió una solicitud de mentoría',
  'listing.created': 'Creó una vivienda',
  'listing.updated': 'Editó una vivienda',
  'listing.submitted': 'Envió una vivienda a revisión',
  'listing.criteria_set': 'Marcó revisiones',
  'listing.decided': 'Decidió sobre una vivienda',
  'listing.archived': 'Archivó una vivienda',
  'listing.photo_added': 'Agregó una foto',
  'listing.reported': 'Reportó una vivienda',
  'listing.flagged': 'Vivienda ocultada por reportes',
  'mentor.profile_saved': 'Guardó su perfil de mentor',
  'mentor.decided': 'Decidió sobre un mentor',
  'mentor.approved': 'Aprobó un perfil de mentor',
  'mentor.rejected': 'Rechazó un perfil de mentor',
  'review.created': 'Publicó una reseña',
  'student.verification_requested': 'Envió su matrícula',
  'student.decided': 'Decidió sobre una matrícula',
  'student.approved': 'Validó una matrícula',
  'student.rejected': 'Rechazó una matrícula',
  'user.registered': 'Creó su cuenta',
  'user.locked': 'Cuenta bloqueada por intentos fallidos',
  'user.logout_all': 'Cerró sesión en todos sus dispositivos',
  'user.password_reset': 'Cambió su contraseña',
  'user.deleted': 'Eliminó su cuenta',
}
const AUDIT_ENTITY: Record<string, string> = {
  booking: 'Solicitud',
  conversation: 'Conversación',
  listing: 'Vivienda',
  mentor: 'Mentor',
  report: 'Reporte',
  review: 'Reseña',
  user: 'Cuenta',
}

function Audit() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-audit', page], queryFn: () => api.get<Paged<AuditEntry>>(`/admin/audit?page=${page}`) })
  return (
    <div className="stack">
      <h2 className="sr-only">Bitácora</h2>
      <ErrorNote error={error} onRetry={() => void refetch()} />
      {isLoading && <Loading />}
      {data && (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Acción</th><th scope="col">Sobre</th></tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>{shortDateTime(a.createdAt)}</td>
                  <td>{a.actorName ?? 'Sistema'}</td>
                  <td>{AUDIT_ACTION[a.action] ?? a.action}</td>
                  <td>{AUDIT_ENTITY[a.entity] ?? a.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.items.length === 0 && <Empty title="La bitácora está vacía" />}
      {data && data.total > data.pageSize && (
        <div className="btnrow">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Más recientes</Button>
          <Button variant="secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Anteriores</Button>
        </div>
      )}
    </div>
  )
}
