import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BOOKING_STEP_LABEL, type Booking, type BookingAction, type BookingStatus } from '@aterriza/contracts'
import { Button, Empty, ErrorNote, LinkButton, Loading, Note, Page, TextInput } from '../design/ui'
import { api } from '../lib/api'
import { ACTION_LABEL, STATUS_LABEL, dateOnly, dateTime, money } from '../lib/format'
import { useSession } from '../lib/session'

const CHIP: Record<BookingStatus, string> = {
  requested: 'chip--wait',
  tour_scheduled: 'chip--wait',
  accepted: 'chip--ok',
  confirmed: 'chip--ok',
  completed: 'chip--ok',
  rejected: 'chip--stop',
  cancelled: 'chip--stop',
}

export function BookingsPage() {
  const { me } = useSession()
  const { data, isLoading, error } = useQuery({ queryKey: ['bookings'], queryFn: () => api.get<Booking[]>('/bookings') })
  const isLandlord = me?.role === 'landlord'
  return (
    <Page title={isLandlord ? 'Solicitudes recibidas' : 'Mis solicitudes'}>
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && (
        <Empty title={isLandlord ? 'Aún no recibes solicitudes' : 'Aún no has solicitado ninguna vivienda'}>
          {!isLandlord && <LinkButton to="/viviendas" variant="secondary">Buscar vivienda</LinkButton>}
        </Empty>
      )}
      <div className="rowlist">
        {data?.map((b) => (
          <Link key={b.id} to={`/solicitudes/${b.id}`} className="rowcard">
            {b.listing.photo ? <img src={b.listing.photo.url} alt="" /> : <div className="rowcard__ph" />}
            <div>
              <h3>{b.listing.title}</h3>
              <p className="muted small">
                {isLandlord ? `${b.studentName}, ` : ''}
                {dateOnly(b.startDate)} al {dateOnly(b.endDate)}
              </p>
            </div>
            <span className={`chip ${CHIP[b.status]}`}>{STATUS_LABEL[b.status]}</span>
          </Link>
        ))}
      </div>
    </Page>
  )
}

const NEXT_STEP: Partial<Record<BookingStatus, { student: string; landlord: string }>> = {
  requested: { student: 'El arrendador revisará tu solicitud. Pídele una videollamada por el chat.', landlord: 'Agenda una videollamada para mostrar el lugar, o responde a la solicitud.' },
  tour_scheduled: { student: 'En la videollamada, pide que te muestren el lugar en vivo. No pagues todavía.', landlord: 'Después de la videollamada, acepta o rechaza la solicitud.' },
  accepted: { student: 'Ya puedes ver la dirección. Firma el contrato y pide recibo por cada pago antes de confirmar.', landlord: 'Firma el contrato con el estudiante. Cuando lo confirme, la vivienda dejará de aparecer en la búsqueda.' },
  confirmed: { student: 'Todo listo. Revisa tu checklist para tu llegada.', landlord: 'Al terminar la estancia, márcala como concluida.' },
  completed: { student: 'Tu reseña ayudará a quien venga después.', landlord: 'La vivienda volvió a estar disponible.' },
}

export function BookingPage() {
  const { id } = useParams()
  const { me } = useSession()
  const client = useQueryClient()
  const [tourAt, setTourAt] = useState('')
  const [askTour, setAskTour] = useState(false)
  const { data: b, isLoading, error } = useQuery({ queryKey: ['booking', id], queryFn: () => api.get<Booking>(`/bookings/${id}`) })
  const act = useMutation({
    mutationFn: (body: { action: BookingAction; tourAt?: string }) => api.post<Booking>(`/bookings/${id}/transitions`, body),
    onSuccess: (updated) => {
      client.setQueryData(['booking', id], updated)
      setAskTour(false)
      void client.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
  const toggleStep = useMutation({
    mutationFn: ({ step, done }: { step: string; done: boolean }) => api.put(`/bookings/${id}/steps/${step}`, { done }),
    // La casilla responde al instante; si el servidor falla, onSettled trae el estado real.
    onMutate: ({ step, done }) => client.setQueryData<Booking>(['booking', id], (prev) => prev && { ...prev, steps: prev.steps.map((x) => (x.id === step ? { ...x, done } : x)) }),
    onSettled: () => client.invalidateQueries({ queryKey: ['booking', id] }),
  })
  if (isLoading) return <div className="page"><Loading /></div>
  if (error || !b) return <div className="page page--narrow"><Empty title="No encontramos esta solicitud"><LinkButton to="/solicitudes" variant="secondary">Ver mis solicitudes</LinkButton></Empty></div>

  const asStudent = me?.role === 'student'
  const next = NEXT_STEP[b.status]
  return (
    <Page title={b.listing.title} lead={`${b.listing.zoneName}. ${money(b.listing.monthlyRentMxn)} al mes.`}>
      <div className="twocol">
        <div className="stack">
          <div className="panel stack">
            <div className="btnrow" style={{ justifyContent: 'space-between' }}>
              <span>
                <span className={`chip ${CHIP[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                <span className="small muted" style={{ marginLeft: 10 }}>Referencia {b.reference}</span>
              </span>
              <Link to={`/viviendas/${b.listing.id}`} className="small">Ver la vivienda</Link>
            </div>
            {next && <p>{asStudent ? next.student : next.landlord}</p>}
            {b.tourAt && <Note title="Videollamada">{dateTime(b.tourAt)}. La hacen por el medio que acuerden en el chat.</Note>}
            {b.exactAddress ? <Note tone="ok" title="Dirección exacta">{b.exactAddress}</Note> : <p className="small muted">La dirección exacta aparece cuando el arrendador acepta.</p>}
            <dl className="facts" style={{ marginTop: 0 }}>
              <div><dt>Estudiante</dt><dd>{b.studentName}</dd></div>
              <div><dt>Arrendador</dt><dd>{b.landlordName}</dd></div>
              <div><dt>Entrada</dt><dd>{dateOnly(b.startDate)}</dd></div>
              <div><dt>Salida</dt><dd>{dateOnly(b.endDate)}</dd></div>
            </dl>
            {askTour && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  act.mutate({ action: 'schedule_tour', tourAt: new Date(tourAt).toISOString() })
                }}
              >
                <TextInput label="Fecha y hora de la videollamada" type="datetime-local" value={tourAt} onChange={(e) => setTourAt(e.target.value)} required />
                <div className="btnrow">
                  <Button type="submit" busy={act.isPending}>Confirmar videollamada</Button>
                  <Button type="button" variant="quiet" onClick={() => setAskTour(false)}>Cancelar</Button>
                </div>
              </form>
            )}
            <ErrorNote error={act.error} />
            {!askTour && b.allowedActions.length > 0 && (
              <div className="btnrow">
                {b.allowedActions.map((action) => {
                  const danger = action === 'reject' || action === 'cancel'
                  return (
                    <Button
                      key={action}
                      variant={danger ? 'danger' : action === 'schedule_tour' && b.allowedActions.includes('accept') ? 'secondary' : 'primary'}
                      busy={act.isPending}
                      onClick={() => (action === 'schedule_tour' ? setAskTour(true) : act.mutate({ action }))}
                    >
                      {ACTION_LABEL[action]}
                    </Button>
                  )
                })}
              </div>
            )}
            {b.canReview && <div><LinkButton to={`/viviendas/${b.listing.id}`}>Dejar mi reseña</LinkButton></div>}
          </div>
          {asStudent && !['rejected', 'cancelled', 'completed'].includes(b.status) && (
            <section className="panel stack">
              <div>
                <h2 style={{ fontSize: '1.8rem' }}>Lista para mudarte</h2>
                <p className="small muted">{b.steps.filter((s) => s.done).length} de {b.steps.length} listos. Solo marcas tu avance: aquí no se suben documentos.</p>
              </div>
              <div className="tasks" style={{ marginTop: 0 }}>
                {b.steps.map((s) => (
                  <label key={s.id} className={`task task--bare ${s.done ? 'is-done' : ''}`}>
                    <input type="checkbox" checked={s.done} onChange={(e) => toggleStep.mutate({ step: s.id, done: e.target.checked })} />
                    <span>
                      <span className="task__title">{BOOKING_STEP_LABEL[s.id].title}</span>
                      <br />
                      <span className="task__hint">{BOOKING_STEP_LABEL[s.id].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <ErrorNote error={toggleStep.error} />
            </section>
          )}
          {b.conversationId && (
            <div>
              <LinkButton to={`/mensajes/${b.conversationId}`} variant="secondary">
                Abrir el chat con {asStudent ? b.landlordName : b.studentName}
              </LinkButton>
            </div>
          )}
          {asStudent && (
            <Note tone="warning" title="Aterriza no procesa pagos">
              Si te piden transferir antes de firmar contrato o de ver el lugar, no lo hagas y repórtalo. <Link to="/guias/como-reconocer-una-estafa">Cómo reconocer una estafa</Link>
            </Note>
          )}
        </div>
        <aside className="panel">
          <h2 style={{ fontSize: '1.8rem', marginBottom: 14 }}>Línea de tiempo</h2>
          <ol className="timeline">
            {b.events.map((e) => (
              <li key={e.id}>
                <p><b>{STATUS_LABEL[e.toStatus]}</b></p>
                <p className="small muted">{dateTime(e.createdAt)}, {e.actorName}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </Page>
  )
}
