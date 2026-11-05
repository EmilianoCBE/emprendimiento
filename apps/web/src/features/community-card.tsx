import './community.css'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { MentorCard } from '@aterriza/contracts'
import { Button, ErrorNote, TextArea } from '../design/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { useToast } from '../lib/toast'

/** La mayoría estudia en el mismo campus: solo se menciona la universidad cuando es otra. */
const HOME_UNIVERSITY = 'Tec de Monterrey'

function mentorOrigin(m: MentorCard): string {
  const from = m.kind === 'local' ? 'Estudiante local.' : m.homeCountry ? `De ${m.homeCountry}.` : 'Llegó de fuera.'
  const zone = m.zoneName ? ` ${m.kind === 'local' ? 'Conoce' : 'Vivió en'} ${m.zoneName}.` : ''
  const university = m.university.startsWith(HOME_UNIVERSITY) ? '' : ` ${m.university}.`
  return `${from}${zone}${university}`
}

export function MentorCardView({ mentor: m, headingLevel: Heading = 'h2' }: { mentor: MentorCard; headingLevel?: 'h2' | 'h3' }) {
  const { me } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [intro, setIntro] = useState('')
  const toast = useToast()
  const connect = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>(`/mentors/${m.id}/connect`, { intro }),
    onSuccess: ({ conversationId }) => {
      toast(`Solicitud enviada a ${m.fullName}. Te avisaremos cuando responda.`)
      navigate(`/mensajes/${conversationId}`)
    },
  })
  const canConnect = me?.role === 'student' && me.studentStatus === 'verified'
  return (
    <article className="mentor">
      <div>
        <Heading className="mentor__name">{m.fullName}</Heading>
        <p className="mentor__where">{mentorOrigin(m)}</p>
      </div>
      <div className="mentor__about">
        <p className="mentor__headline">{m.headline}</p>
        <details className="mentor__more">
          <summary>Leer más</summary>
          <p>{m.bio}</p>
        </details>
      </div>
      <div className="mentor__meta">
        <div className="chips">
          {m.topics.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
        <p className="mentor__langs">Habla {m.languages.join(', ').toLowerCase()}.</p>
      </div>
      <div className="mentor__action">
        {!m.accepting && <p className="small muted">No recibe solicitudes por ahora.</p>}
        {m.accepting && !me && <Link className="small" to="/entrar?volver=/mentores">Inicia sesión para escribirle</Link>}
        {m.accepting && me?.role === 'student' && !canConnect && (
          <p className="small"><Link to="/cuenta">Valida tu matrícula</Link> para escribirle.</p>
        )}
        {m.accepting && canConnect && !open && <Button variant="secondary" onClick={() => setOpen(true)}>Escribirle</Button>}
      </div>
      {open && (
        <form
          className="form mentor__form"
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
    </article>
  )
}
