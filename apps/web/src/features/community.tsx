import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom'
import type { ChatMessage, Conversation, MentorCard, Zone } from '@aterriza/contracts'
import { Button, Empty, ErrorNote, Loading, Note, Page, Select } from '../design/ui'
import { api } from '../lib/api'
import { shortDateTime } from '../lib/format'
import { useSession } from '../lib/session'
import { MentorCardView } from './community-card'

const TOPICS = ['Vivienda', 'Zonas', 'Transporte', 'Dinero', 'Visa', 'Salud', 'Cultura', 'Vida diaria']
const LANGUAGES = ['Español', 'Inglés', 'Francés', 'Coreano']

export function MentorsPage() {
  const [params, setParams] = useSearchParams()
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const q = params.toString()
  const { data, isLoading, error } = useQuery({ queryKey: ['mentors', q], queryFn: () => api.get<MentorCard[]>(`/mentors?${q}`) })
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Page title="Mentores" lead="Estudiantes de tu universidad que conocen la ciudad o ya vivieron el cambio. Busca a alguien cuya zona y experiencia se parezcan a lo que vas a vivir.">
      <div className="filters" style={{ marginBottom: 26 }}>
        <Select label="Experiencia" value={params.get('kind') ?? ''} onChange={(e) => set('kind', e.target.value)}>
          <option value="">Toda</option>
          <option value="local">Estudiante local</option>
          <option value="ex_exchange">Ya vivió el cambio</option>
        </Select>
        <Select label="Tema" value={params.get('topic') ?? ''} onChange={(e) => set('topic', e.target.value)}>
          <option value="">Todos</option>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Idioma" value={params.get('language') ?? ''} onChange={(e) => set('language', e.target.value)}>
          <option value="">Todos</option>
          {LANGUAGES.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Zona" value={params.get('zone') ?? ''} onChange={(e) => set('zone', e.target.value)}>
          <option value="">Todas</option>
          {zones.data?.map((z) => <option key={z.id} value={z.slug}>{z.name}</option>)}
        </Select>
      </div>
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && (
        <Empty title="Ningún mentor cumple con estos filtros">
          <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Quitar filtros</Button>
        </Empty>
      )}
      <div className="mentors">
        {data?.map((m) => <MentorCardView key={m.id} mentor={m} />)}
      </div>
    </Page>
  )
}

export function MessagesPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conversation[]>('/conversations') })
  return (
    <Page title="Mensajes">
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && (
        <Empty title="Aún no tienes conversaciones">
          <p className="muted">Pide hablar con un <Link to="/mentores">mentor</Link> o solicita una <Link to="/viviendas">vivienda</Link> para empezar.</p>
        </Empty>
      )}
      {data && data.length > 0 && (
        <div className="chat" data-open={id ? 'true' : 'false'}>
          <nav className="chat__list" aria-label="Conversaciones">
            {data.map((c) => (
              <NavLink key={c.id} to={`/mensajes/${c.id}`} className="convo">
                <div className="convo__top">
                  <span>{c.otherName}</span>
                  {c.unread > 0 && <span className="convo__unread">{c.unread}<span className="sr-only"> sin leer</span></span>}
                </div>
                <p className="convo__sub">{c.listingTitle ?? c.otherSubtitle}</p>
                {c.status === 'pending' ? <p className="convo__last">Solicitud pendiente</p> : c.lastMessage && <p className="convo__last">{c.lastMessage}</p>}
              </NavLink>
            ))}
          </nav>
          <div className="chat__pane">
            {id ? <ConversationPane key={id} id={id} /> : <div className="chat__pad muted">Elige una conversación.</div>}
          </div>
        </div>
      )}
    </Page>
  )
}

function ConversationPane({ id }: { id: string }) {
  const { me } = useSession()
  const client = useQueryClient()
  const [body, setBody] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const convo = useQuery({ queryKey: ['conversations', id], queryFn: () => api.get<Conversation>(`/conversations/${id}`) })
  const messages = useQuery({ queryKey: ['messages', id], queryFn: () => api.get<ChatMessage[]>(`/conversations/${id}/messages`), staleTime: 0 })

  const count = messages.data?.length ?? 0
  useEffect(() => {
    // Solo dentro del panel de mensajes, sin desplazar la página.
    endRef.current?.parentElement?.scrollTo({ top: 1e9 })
    if (count > 0) void client.invalidateQueries({ queryKey: ['conversations'], exact: true })
  }, [count, client])

  const send = useMutation({
    mutationFn: (text: string) => api.post<ChatMessage>(`/conversations/${id}/messages`, { body: text }),
    onSuccess: (message) => {
      setBody('')
      client.setQueryData<ChatMessage[]>(['messages', id], (prev) => [...(prev ?? []), message])
    },
  })
  const respond = useMutation({
    mutationFn: (accept: boolean) => api.post(`/conversations/${id}/respond`, { accept }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] })
      void client.invalidateQueries({ queryKey: ['messages', id] })
    },
  })

  const c = convo.data
  if (!c) return <div className="chat__pad">{convo.error ? <ErrorNote error={convo.error} /> : <Loading />}</div>

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (body.trim()) send.mutate(body)
  }

  return (
    <>
      <header className="chat__head">
        <h2>{c.otherName}</h2>
        <p className="small muted">{c.listingTitle ?? c.otherSubtitle}</p>
        <Link className="small" to="/mensajes">Volver a conversaciones</Link>
      </header>
      <div className="chat__msgs" aria-live="polite">
        {c.status === 'pending' && !c.iAmStudent && (
          <Note title="Quiere hablar contigo">
            <p>{c.intro}</p>
            <div className="btnrow" style={{ marginTop: 10 }}>
              <Button busy={respond.isPending} onClick={() => respond.mutate(true)}>Aceptar</Button>
              <Button variant="secondary" busy={respond.isPending} onClick={() => respond.mutate(false)}>Ahora no puedo</Button>
            </div>
            <ErrorNote error={respond.error} />
          </Note>
        )}
        {c.status === 'pending' && c.iAmStudent && <Note title="Esperando respuesta">Te avisaremos cuando {c.otherName} responda.</Note>}
        {c.status === 'declined' && <Note title="Esta persona no puede atenderte ahora"><Link to="/mentores">Busca a otro mentor</Link></Note>}
        {messages.data?.map((m) => {
          const mine = m.senderId === me?.id
          return (
            <div key={m.id} className={`msg ${mine ? 'msg--mine' : ''}`}>
              {m.body}
              <p className="msg__time">{shortDateTime(m.createdAt)}</p>
              {m.riskFlags.length > 0 && !mine && (
                <p className="msg__risk" role="note">
                  Ten cuidado: {m.riskFlags.map((f) => f.label.toLowerCase()).join('; ')}. No transfieras dinero sin ver el lugar y sin contrato. <Link to="/guias/como-reconocer-una-estafa">Cómo reconocer una estafa</Link>
                </p>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {c.status === 'active' ? (
        <form className="chat__form" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-input">Escribe un mensaje</label>
          <input id="chat-input" className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un mensaje" maxLength={2000} autoComplete="off" />
          <Button type="submit" busy={send.isPending} disabled={!body.trim()}>Enviar</Button>
        </form>
      ) : (
        c.status === 'closed' && <div className="chat__pad muted small">Esta conversación está cerrada.</div>
      )}
      {send.error != null && <div style={{ padding: '0 12px 12px' }}><ErrorNote error={send.error} /></div>}
    </>
  )
}
