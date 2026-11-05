import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BudgetEstimate, ListingCard as Card, MentorCard, Paged, Zone } from '@aterriza/contracts'
import { Ridge, Seal } from '../design/brand'
import { CriteriaList, LinkButton, Button, Select, TextInput } from '../design/ui'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { ListingCardView } from './listings-card'

const ALL_MET = (['ownership_docs', 'landlord_identity', 'model_contract', 'dated_photos'] as const).map((id) => ({ id, met: true, checkedAt: null }))

export function LandingPage() {
  const navigate = useNavigate()
  const [zone, setZone] = useState('')
  const [maxRent, setMaxRent] = useState('')
  const [maxMinutes, setMaxMinutes] = useState('')
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const featured = useQuery({ queryKey: ['featured'], queryFn: () => api.get<Paged<Card>>('/listings?verifiedOnly=true&pageSize=4') })
  const mentors = useQuery({ queryKey: ['mentors', {}], queryFn: () => api.get<MentorCard[]>('/mentors') })

  // Estudio con renta de ejemplo: el resultado sale de la misma calculadora que usa la persona.
  const EXAMPLE_RENT = 11900
  const example = useQuery({
    queryKey: ['landing-example'],
    queryFn: () => api.post<BudgetEstimate>('/budget/estimate', { monthlyRent: EXAMPLE_RENT, depositMonths: 1, minutesTransit: 8, arrivalMonth: 8, usesAc: true, international: true }),
    staleTime: Infinity,
  })
  const hero = featured.data?.items[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = new URLSearchParams()
    if (zone) q.set('zone', zone)
    if (maxRent) q.set('maxRent', maxRent)
    if (maxMinutes) q.set('maxMinutes', maxMinutes)
    navigate(`/viviendas?${q}`)
  }

  return (
    <>
      <section className="hero">
        <div className="hero__sky">
          <h1 className="hero__title">Llega a Monterrey sabiendo dónde vas a vivir</h1>
          <p className="hero__sub">Vivienda que una persona ya revisó y estudiantes que pasaron por lo mismo, antes de que transfieras un solo peso.</p>
          {hero && hero.photo && (
            <figure className="hero__pass">
              <img className="hero__photo" src={hero.photo.url} alt={hero.photo.alt} width={400} height={500} />
              <Seal met={4} size={118} stamp />
              <figcaption className="hero__caption">
                <span>{hero.zoneName}</span>
                <b>{money(hero.monthlyRentMxn)}</b>
              </figcaption>
            </figure>
          )}
        </div>
        <Ridge />
        <div className="hero__ground">
          <form className="hero__search" onSubmit={submit} aria-label="Buscar vivienda">
            <Select label="Zona" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Cualquier zona</option>
              {zones.data?.map((z) => (
                <option key={z.id} value={z.slug}>
                  {z.name}
                </option>
              ))}
            </Select>
            <TextInput label="Renta máxima al mes" type="number" inputMode="numeric" min={0} step={500} placeholder="Ejemplo: 12000" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} />
            <Select label="Distancia al campus" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)}>
              <option value="">Sin importar</option>
              <option value="10">Hasta 10 minutos</option>
              <option value="15">Hasta 15 minutos</option>
              <option value="25">Hasta 25 minutos</option>
            </Select>
            <Button type="submit">Buscar vivienda</Button>
          </form>
        </div>
      </section>

      <section className="band band--paper">
        <div className="band__in explain">
          <div className="explain__seal">
            <Seal met={4} size={380} stamp />
          </div>
          <div>
            <h2 className="band__head">Un sello que dice exactamente qué se revisó</h2>
            <p className="band__lead">Cada segmento del sello es una revisión hecha por una persona. Si falta alguna, se nota, y esa vivienda todavía no se puede solicitar.</p>
            <CriteriaList criteria={ALL_MET} />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="band__in">
          <h2 className="band__head">Viviendas con sus cuatro revisiones</h2>
          <div className="grid">
            {featured.data?.items.map((l) => (
              <ListingCardView key={l.id} listing={l} />
            ))}
          </div>
          <div className="btnrow" style={{ marginTop: 32 }}>
            <LinkButton to="/viviendas" variant="secondary">
              Ver todas las viviendas
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="band band--paper">
        <div className="band__in">
          <h2 className="band__head">De tu país a tu cuarto, en tres pasos</h2>
          <ol className="steps">
            <li>
              <h3>Encuentra un lugar revisado</h3>
              <p className="muted">Filtra por presupuesto y distancia al campus. Cada vivienda dice qué se revisó y cuánto te costará de verdad.</p>
            </li>
            <li>
              <h3>Compruébalo antes de comprometerte</h3>
              <p className="muted">Pide una videollamada, habla con un mentor de esa zona y lee reseñas de quienes vivieron ahí.</p>
            </li>
            <li>
              <h3>Firma y llega con todo listo</h3>
              <p className="muted">Sigue tu solicitud paso a paso: documentos, contrato y dirección exacta, sin pagar nada por adelantado a ciegas.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="band__in">
          <h2 className="band__head">Elige zona sin haberla pisado</h2>
          <div className="tablewrap">
            <table className="zonetable">
              <thead>
                <tr>
                  <th scope="col">Zona</th>
                  <th scope="col">Cómo te mueves al campus</th>
                  <th scope="col" className="num">Renta mediana</th>
                  <th scope="col" className="num">Viviendas</th>
                </tr>
              </thead>
              <tbody>
                {zones.data?.map((z) => (
                  <tr key={z.id}>
                    <th scope="row"><Link to={`/viviendas?zone=${z.slug}`}>{z.name}</Link></th>
                    <td>{z.transitNote}</td>
                    <td className="num">{z.medianRentMxn ? money(z.medianRentMxn) : 'Sin datos'}</td>
                    <td className="num">{z.listingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band band--dark">
        <div className="band__in">
          <blockquote>
            <p className="quote">"Da mucho miedo llegar a la ciudad con las maletas y no tener un lugar seguro donde dormir."</p>
            <footer className="quote__by">Estudiante internacional de intercambio en el Tec, entrevista del proyecto</footer>
          </blockquote>
        </div>
      </section>

      <section className="band band--paper">
        <div className="band__in costs">
          <div>
            <h2 className="band__head">La renta no es lo que vas a pagar</h2>
            <p className="band__lead">Depósito, luz con aire acondicionado, transporte y comisiones de tu banco. Calcula tu primer mes real antes de decidir.</p>
            <LinkButton to="/presupuesto">Calcular mi primer mes</LinkButton>
          </div>
          <div className="costs__pair">
            <div>
              <p className="costs__label">Lo que dice el anuncio</p>
              <p className="costs__rent costs__rent--old">{money(EXAMPLE_RENT)}</p>
            </div>
            <div>
              <p className="costs__label">Un primer mes estimado, llegando en agosto</p>
              <p className="costs__rent">{example.data ? money(example.data.firstMonthTotalMxn) : ' '}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="band__in">
          <h2 className="band__head">Pregúntale a quien ya vivió ahí</h2>
          <p className="band__lead">Mentores de tu universidad, con la zona donde vivieron a la vista, para que el consejo sí aplique a tu caso.</p>
          <div className="mentorstrip">
            {mentors.data?.slice(0, 3).map((m) => (
              <div key={m.id} className="mentor mentor--flat">
                <h3 className="mentor__name">{m.fullName}</h3>
                <p className="mentor__head">{m.headline}</p>
                <p className="mentor__where">
                  {m.university}
                  {m.zoneName ? `. Vivió en ${m.zoneName}.` : ''}
                </p>
              </div>
            ))}
          </div>
          <div className="btnrow" style={{ marginTop: 32 }}>
            <LinkButton to="/mentores" variant="secondary">
              Conocer a los mentores
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  )
}
