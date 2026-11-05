import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { MentorCard } from '@aterriza/contracts'
import { Button, ErrorNote, LinkButton, TextArea } from '../design/ui'
import { api } from '../lib/api'
import { MENTOR_KIND_LABEL } from '../lib/format'
import { useSession } from '../lib/session'

export function MentorCardView({ mentor: m }: { mentor: MentorCard }) {
  const { me } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [intro, setIntro] = useState('')
  const connect = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>(`/mentors/${m.id}/connect`, { intro }),
    onSuccess: ({ conversationId }) => navigate(`/mensajes/${conversationId}`),
  })
  const canConnect = me?.role === 'student' && me.studentStatus === 'verified'
  return (
    <article className="mentor">
      <h3 className="mentor__name">{m.fullName}</h3>
      <p className="mentor__head">{m.headline}</p>
      <p className="mentor__where">
        {MENTOR_KIND_LABEL[m.kind]}
        {m.homeCountry ? `, de ${m.homeCountry}` : ''}. {m.university}.{m.zoneName ? ` Vivió en ${m.zoneName}.` : ''}
      </p>
      <p className="small">{m.bio}</p>
      <div className="chips">
        {m.topics.map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
      <p className="small muted">Habla {m.languages.join(', ').toLowerCase()}.</p>
      <div className="mentor__foot">
        {!m.accepting && <p className="small muted">No recibe solicitudes por ahora.</p>}
        {m.accepting && !me && <LinkButton to="/entrar?volver=/mentores" variant="secondary">Entra para escribirle</LinkButton>}
        {m.accepting && me?.role === 'student' && !canConnect && (
          <p className="small"><Link to="/cuenta">Valida tu matrícula</Link> para escribirle.</p>
        )}
        {m.accepting && canConnect && !open && <Button variant="secondary" onClick={() => setOpen(true)}>Pedir hablar</Button>}
        {open && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              connect.mutate()
            }}
          >
            <TextArea label="Tu primer mensaje" hint="Cuéntale cuándo llegas y qué te preocupa." value={intro} onChange={(e) => setIntro(e.target.value)} required minLength={10} maxLength={500} />
            <ErrorNote error={connect.error} />
            <div className="btnrow">
              <Button type="submit" busy={connect.isPending}>Enviar solicitud</Button>
              <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </div>
    </article>
  )
}
