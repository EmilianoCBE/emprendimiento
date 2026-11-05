import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { CRITERIA, CRITERION_LABEL, REPORT_REASON_LABEL, type AdminMetrics, type AdminQueueItem, type AdminReport, type AuditEntry, type Criterion, type Paged, type PendingMentor, type PendingStudent } from '@aterriza/contracts'
import { Button, Empty, ErrorNote, Loading, Note, Page, PriceAlertNote, TextInput, Toggle } from '../design/ui'
import { api } from '../lib/api'
import { LISTING_STATUS_LABEL, MENTOR_KIND_LABEL, money, shortDateTime } from '../lib/format'

export function AdminPage() {
  return (
    <Page title="Operación">
      <nav className="tabs" aria-label="Secciones de operación">
        <NavLink end to="/admin">Resumen</NavLink>
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
  const { data, error, isLoading } = useQuery({ queryKey: ['admin-metrics'], queryFn: () => api.get<AdminMetrics>('/admin/metrics') })
  if (isLoading) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const items: [string, number][] = [
    ['Viviendas por revisar', data.pendingListings],
    ['Reportes abiertos', data.openReports],
    ['Viviendas públicas', data.activeListings],
    ['Con 4 revisiones', data.verifiedListings],
    ['Personas registradas', data.users],
    ['Estudiantes validados', data.validatedStudents],
    ['Solicitudes', data.bookings],
    ['Conversaciones', data.conversations],
    ['Mensajes con señal de riesgo', data.flaggedMessages],
  ]
  return (
    <div className="stats">
      {items.map(([label, n]) => (
        <div key={label}>
          <p className="stat__n">{n}</p>
          <p className="stat__l">{label}</p>
        </div>
      ))}
    </div>
  )
}

function QueueItem({ item }: { item: AdminQueueItem }) {
  const client = useQueryClient()
  const [marks, setMarks] = useState<Record<Criterion, boolean>>(() => Object.fromEntries(item.criteria.map((c) => [c.id, c.met])) as Record<Criterion, boolean>)
  const [note, setNote] = useState('')
  useEffect(() => {
    setMarks(Object.fromEntries(item.criteria.map((c) => [c.id, c.met])) as Record<Criterion, boolean>)
  }, [item.criteria])
  const decide = useMutation({
    mutationFn: async (decision: 'approve' | 'return' | 'archive') => {
      await api.put(`/admin/listings/${item.id}/criteria`, { criteria: marks })
      await api.post(`/admin/listings/${item.id}/decision`, { decision, note: note || undefined })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-queue'] })
      void client.invalidateQueries({ queryKey: ['listings'] })
    },
  })
  return (
    <article className="review-item">
      {item.photo ? <img src={item.photo.url} alt={item.photo.alt} /> : <div className="rowcard__ph" />}
      <div className="stack" style={{ gap: 8, alignContent: 'start' }}>
        <h3><Link to={`/viviendas/${item.id}`}>{item.title}</Link></h3>
        <p className="muted small">{item.zoneName}, {money(item.monthlyRentMxn)} al mes, publicada por {item.landlordName}</p>
        <div className="chips">
          <span className="chip chip--wait">{LISTING_STATUS_LABEL[item.status]}</span>
          {item.reportCount > 0 && <span className="chip chip--stop">{item.reportCount} {item.reportCount === 1 ? 'reporte' : 'reportes'}</span>}
        </div>
        {item.priceAlert && <PriceAlertNote alert={item.priceAlert} />}
        <TextInput label="Nota para el arrendador (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {CRITERIA.map((c) => (
          <Toggle key={c} label={CRITERION_LABEL[c].title} checked={marks[c]} onChange={(e) => setMarks({ ...marks, [c]: e.target.checked })} />
        ))}
        <ErrorNote error={decide.error} />
        <div className="btnrow">
          <Button busy={decide.isPending} onClick={() => decide.mutate('approve')}>Aprobar</Button>
          <Button variant="secondary" busy={decide.isPending} onClick={() => decide.mutate('return')}>Devolver</Button>
          <Button variant="danger" busy={decide.isPending} onClick={() => decide.mutate('archive')}>Archivar</Button>
        </div>
      </div>
    </article>
  )
}

function Queue() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-queue'], queryFn: () => api.get<AdminQueueItem[]>('/admin/listings/queue') })
  return (
    <div className="stack">
      <Note title="Marca solo lo que comprobaste">
        El sello solo vale lo que valga esta revisión. Con menos de 2 criterios no se puede aprobar; con menos de 4 se publica pero no se puede solicitar.
      </Note>
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay viviendas por revisar" />}
      {data?.map((i) => <QueueItem key={i.id} item={i} />)}
    </div>
  )
}

function Reports() {
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.get<AdminReport[]>('/admin/reports') })
  const resolve = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'dismiss' | 'uphold' }) => api.post(`/admin/reports/${id}/resolve`, { decision }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-reports'] }),
  })
  return (
    <div className="stack">
      <ErrorNote error={error ?? resolve.error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay reportes abiertos" />}
      {data?.map((r) => (
        <article key={r.id} className="panel stack" style={{ gap: 8 }}>
          <h3><Link to={`/viviendas/${r.listingId}`}>{r.listingTitle}</Link></h3>
          <p><b>{REPORT_REASON_LABEL[r.reason]}</b></p>
          {r.detail && <p>{r.detail}</p>}
          <p className="small muted">{r.reporterName}, {shortDateTime(r.createdAt)}. Estado de la vivienda: {LISTING_STATUS_LABEL[r.listingStatus]}.</p>
          <div className="btnrow">
            <Button variant="danger" busy={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, decision: 'uphold' })}>Confirmar y archivar vivienda</Button>
            <Button variant="secondary" busy={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, decision: 'dismiss' })}>Desestimar</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Students() {
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-students'], queryFn: () => api.get<PendingStudent[]>('/admin/students/pending') })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/admin/students/${id}/decision`, { approve }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-students'] }),
  })
  return (
    <div className="stack">
      <ErrorNote error={error ?? decide.error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay matrículas por revisar" />}
      {data?.map((s) => (
        <article key={s.id} className="panel stack" style={{ gap: 8 }}>
          <h3>{s.fullName}</h3>
          <p className="small muted">{s.email}{s.homeCountry ? `, ${s.homeCountry}` : ''}</p>
          <p>Matrícula: <b>{s.matricula}</b></p>
          <div className="btnrow">
            <Button busy={decide.isPending} onClick={() => decide.mutate({ id: s.id, approve: true })}>Validar</Button>
            <Button variant="danger" busy={decide.isPending} onClick={() => decide.mutate({ id: s.id, approve: false })}>Rechazar</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Mentors() {
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-mentors'], queryFn: () => api.get<PendingMentor[]>('/admin/mentors/pending') })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/admin/mentors/${id}/decision`, { approve }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-mentors'] }),
  })
  return (
    <div className="stack">
      <ErrorNote error={error ?? decide.error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="No hay perfiles por aprobar" />}
      {data?.map((m) => (
        <article key={m.id} className="panel stack" style={{ gap: 8 }}>
          <h3>{m.fullName}</h3>
          <p className="small muted">{MENTOR_KIND_LABEL[m.kind]}, {m.university}. {m.email}</p>
          <p><b>{m.headline}</b></p>
          <p>{m.bio}</p>
          <div className="btnrow">
            <Button busy={decide.isPending} onClick={() => decide.mutate({ id: m.id, approve: true })}>Aprobar perfil</Button>
            <Button variant="danger" busy={decide.isPending} onClick={() => decide.mutate({ id: m.id, approve: false })}>Rechazar</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Audit() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-audit', page], queryFn: () => api.get<Paged<AuditEntry>>(`/admin/audit?page=${page}`) })
  return (
    <div className="stack">
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data && (
        <div className="tablewrap">
          <table className="datatable">
            <thead>
              <tr><th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Acción</th><th scope="col">Sobre</th></tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>{shortDateTime(a.createdAt)}</td>
                  <td>{a.actorName ?? 'Sistema'}</td>
                  <td>{a.action}</td>
                  <td>{a.entity}</td>
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
