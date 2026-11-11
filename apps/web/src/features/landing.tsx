import './landing.css'
import { Bus, Calculator, ChatsCircle, CheckCircle, MagnifyingGlass, MapPin, Prohibit } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CRITERIA, CRITERION_LABEL, type BudgetEstimate, type ListingCard as Card, type MentorCard, type Paged, type Zone } from '@aterriza/contracts'
import { LinkButton, Select, TextInput } from '../design/ui'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useReveal } from '../lib/reveal'
import { ListingCardView } from './listings-card'

const HERO_PHOTO = '/demo/depa-sala-comedor.jpg'

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

export function LandingPage() {
  const navigate = useNavigate()
  useReveal()
  const [zone, setZone] = useState('')
  const [maxRent, setMaxRent] = useState('')
  const [maxMinutes, setMaxMinutes] = useState('')
  const [railZone, setRailZone] = useState<string | null>(null)
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const featured = useQuery({ queryKey: ['featured'], queryFn: () => api.get<Paged<Card>>('/listings?verifiedOnly=true&pageSize=8') })
  const mentors = useQuery({ queryKey: ['mentors', {}], queryFn: () => api.get<MentorCard[]>('/mentors') })

  // Estudio con renta de ejemplo: el resultado sale de la misma calculadora que usa la persona.
  const EXAMPLE_RENT = 11900
  const example = useQuery({
    queryKey: ['landing-example'],
    queryFn: () => api.post<BudgetEstimate>('/budget/estimate', { monthlyRent: EXAMPLE_RENT, depositMonths: 1, minutesTransit: 8, arrivalMonth: 8, usesAc: true, international: true }),
    staleTime: Infinity,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = new URLSearchParams()
    if (zone) q.set('zone', zone)
    if (maxRent) q.set('maxRent', maxRent)
    if (maxMinutes) q.set('maxMinutes', maxMinutes)
    navigate(`/viviendas?${q}`)
  }

  const homes = featured.data?.items ?? []
  const railZones = [...new Set(homes.map((l) => l.zoneName))]
  const shown = railZone ? homes.filter((l) => l.zoneName === railZone) : homes
  const mockPhotos = homes.flatMap((l) => (l.photo ? [l.photo.url] : [])).slice(0, 3)

  return (
    <>
      <section className="hero">
        <img className="hero__photo" src={HERO_PHOTO} alt="" />
        <div className="hero__in">
          <h1 className="hero__title">Llega a Monterrey sabiendo dónde vas a vivir</h1>
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
            <button type="submit" className="btn btn--primary hero__go">
              <MagnifyingGlass size={20} weight="bold" aria-hidden />
              Buscar vivienda
            </button>
          </form>
          <ul className="hero__trust">
            <li>
              <CheckCircle size={20} weight="bold" aria-hidden />4 revisiones por vivienda
            </li>
            <li>
              <ChatsCircle size={20} weight="bold" aria-hidden />
              Mentores de tu campus
            </li>
            <li>
              <Prohibit size={20} weight="bold" aria-hidden />
              Aquí no se transfiere dinero
            </li>
          </ul>
        </div>
      </section>

      <section className="factsbar" aria-label="Aterriza en pocas palabras">
        <dl>
          <div>
            <dt>{zones.data ? `${zones.data.length} zonas` : 'Zonas'}</dt>
            <dd>alrededor del Tec, Campus Monterrey</dd>
          </div>
          <div>
            <dt>{CRITERIA.length} revisiones</dt>
            <dd>hechas por una persona en cada vivienda</dd>
          </div>
          <div>
            <dt>Mentores por zona</dt>
            <dd>estudiantes que ya vivieron ahí</dd>
          </div>
          <div>
            <dt>{money(0)} dentro de la plataforma</dt>
            <dd>no cobramos ni procesamos tu renta</dd>
          </div>
        </dl>
      </section>

      <section className="reveal band">
        <h2 className="band__head">Zonas cerca del campus</h2>
        <p className="band__lead">Elige zona sin haberla pisado: cómo te mueves y cuánto cuesta vivir ahí.</p>
        <ul className="zonetiles">
          {zones.isPending && Array.from({ length: 5 }, (_, i) => <li key={i} className="zonetiles__ph" aria-hidden />)}
          {zones.data?.map((z) => (
            <li key={z.id}>
              <Link to={`/viviendas?zone=${z.slug}`} className="zonetile">
                <span className="zonetile__move">
                  <Bus size={16} weight="bold" aria-hidden />
                  {z.transitNote}
                </span>
                <h3 className="zonetile__name">{z.name}</h3>
                <p className="zonetile__meta">
                  {z.medianRentMxn ? `Renta mediana ${money(z.medianRentMxn)}` : 'Sin datos de renta'} · {z.listingCount} {z.listingCount === 1 ? 'vivienda' : 'viviendas'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="reveal band band--rail">
        <h2 className="band__head">Viviendas con sus cuatro revisiones</h2>
        <p className="band__lead">El costo con gastos es una estimación.</p>
        <div className="railbar" role="group" aria-label="Filtrar por zona">
          <button type="button" className="pill" aria-pressed={railZone === null} onClick={() => setRailZone(null)}>
            Todas
          </button>
          {railZones.map((name) => (
            <button key={name} type="button" className="pill" aria-pressed={railZone === name} onClick={() => setRailZone(name)}>
              {name}
            </button>
          ))}
          <Link to="/viviendas" className="railbar__all">
            Ver todas las viviendas
          </Link>
        </div>
        <div className="rail" key={railZone ?? 'todas'}>
          {featured.isPending &&
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="rail__item rail__ph" aria-hidden>
                <div className="skeleton__media" />
                <div className="skeleton__line" />
                <div className="skeleton__line" />
              </div>
            ))}
          {shown.map((l) => (
            <div key={l.id} className="rail__item">
              <ListingCardView listing={l} />
            </div>
          ))}
        </div>
      </section>

      <section className="reveal band band--soft" id="mentores">
        <div className="band__row">
          <div>
            <h2 className="band__head">Pregúntale a quien ya vivió ahí</h2>
            <p className="band__lead">Mentores que conocen tu campus y tu zona, para que el consejo sí aplique a tu caso.</p>
          </div>
          <Link to="/mentores" className="band__link">
            Conocer a los mentores
          </Link>
        </div>
        <ul className="voices">
          {mentors.isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="voice voice--ph" aria-hidden>
                <div className="skeleton__line" />
                <div className="skeleton__line" />
                <div className="skeleton__line" />
              </li>
            ))}
          {mentors.data?.slice(0, 4).map((m) => (
            <li key={m.id} className="voice">
              <p className="voice__quote">{m.headline}</p>
              <div className="voice__who">
                <span className="voice__avatar" aria-hidden>
                  {initials(m.fullName)}
                </span>
                <p>
                  <b>{m.fullName}</b>
                  <span className="muted small">{[m.homeCountry && `De ${m.homeCountry}`, m.zoneName && `conoce ${m.zoneName}`].filter(Boolean).join(', ')}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="reveal band">
        <h2 className="band__head">De tu ciudad a tu cuarto en 3 pasos</h2>
        <ol className="steps">
          <li>
            <div className="mock" aria-hidden>
              <div className="mock__field">
                <MapPin size={18} weight="bold" />
                {zones.data?.[0]?.name ?? 'Zona'}
              </div>
              <div className="mock__chips">
                <span className="is-on">Renta máxima</span>
                <span>A pie del campus</span>
                <span>Amueblado</span>
              </div>
              <div className="mock__photos">
                {mockPhotos.map((url) => (
                  <img key={url} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </div>
            <span className="steps__n">1</span>
            <h3>Encuentra un lugar revisado</h3>
            <p className="muted">Filtra por presupuesto y distancia al campus. Cada vivienda dice qué se revisó y cuánto te costará de verdad.</p>
          </li>
          <li>
            <div className="mock" aria-hidden>
              <p className="mock__title">
                <span>Revisiones de la vivienda</span>
                <span className="mock__count">3 de {CRITERIA.length}</span>
              </p>
              {CRITERIA.map((id, i) =>
                i < CRITERIA.length - 1 ? (
                  <div key={id} className="mock__check is-met">
                    {CRITERION_LABEL[id].title}
                    <CheckCircle size={20} weight="bold" />
                  </div>
                ) : (
                  <div key={id} className="mock__check">
                    {CRITERION_LABEL[id].title}
                    <span>En revisión</span>
                  </div>
                ),
              )}
            </div>
            <span className="steps__n">2</span>
            <h3>Compruébalo antes de comprometerte</h3>
            <p className="muted">Mira qué se revisó, pide una videollamada y habla con un mentor de esa zona.</p>
          </li>
          <li>
            <div className="mock mock--center" aria-hidden>
              <div className="ticket">
                <div className="ticket__head">
                  {mockPhotos[1] && <img src={mockPhotos[1]} alt="" loading="lazy" />}
                  <b>Tu solicitud</b>
                  <span>Aceptada</span>
                </div>
                <div className="ticket__row">
                  <span>
                    <small>Estancia</small>
                    <b>5 meses</b>
                  </span>
                  <span>
                    <small>Depósito</small>
                    <b>1 mes</b>
                  </span>
                  <span>
                    <small>Dirección</small>
                    <b>Compartida</b>
                  </span>
                </div>
                <div className="ticket__foot">
                  <b>Contrato</b>
                  <span>Por firmar</span>
                </div>
              </div>
            </div>
            <span className="steps__n">3</span>
            <h3>Firma y llega con todo listo</h3>
            <p className="muted">Sigue tu solicitud paso a paso: documentos, contrato y dirección exacta, sin pagar nada por adelantado a ciegas.</p>
          </li>
        </ol>
      </section>

      <section className="reveal band" id="costos">
        <div className="costs">
          <div>
            <h2 className="costs__head">La renta no es lo que vas a pagar</h2>
            <p className="costs__lead">
              El anuncio dice {money(EXAMPLE_RENT)}. Con depósito, luz con aire acondicionado, transporte y comisiones de tu banco, tu primer mes se parece más a este recibo.
            </p>
            <Link to="/presupuesto" className="btn costs__cta">
              <Calculator size={20} weight="bold" aria-hidden />
              Calcular mi primer mes
            </Link>
          </div>
          <div className="receipt">
            <p className="receipt__title">Tu primer mes, estimado</p>
            <p className="receipt__sub">Un estudio a 8 minutos del campus, llegando en agosto</p>
            {example.data ? (
              <dl className="receipt__lines">
                {example.data.lines.map((line) => (
                  <div key={line.id}>
                    <dt>{line.label}</dt>
                    <dd>{money(line.amountMxn)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="receipt__ph" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton__line" />
                ))}
              </div>
            )}
            <p className="receipt__total">
              <span>Total</span>
              <b className="figure">{example.data ? money(example.data.firstMonthTotalMxn) : ' '}</b>
            </p>
            <p className="receipt__note">Montos estimados con supuestos del equipo, salvo la renta y el depósito.</p>
          </div>
        </div>
      </section>

      <section className="reveal band help" id="ayuda">
        <div>
          <h2 className="band__head">Lo que casi todos preguntan</h2>
          <p className="band__lead">Respuestas cortas. Si la tuya no está, escríbele a un mentor.</p>
          <LinkButton to="/ayuda" variant="secondary">
            Ver toda la ayuda
          </LinkButton>
        </div>
        <div className="help__list">
          <details open>
            <summary>¿Tengo que pagar algo dentro de Aterriza?</summary>
            <p>No. La plataforma no cobra ni procesa pagos de renta. Si alguien te pide transferir antes de la videollamada o del contrato, es una señal de alerta: repórtalo.</p>
          </details>
          <details>
            <summary>¿Qué pasa si una vivienda tiene 2 de 4 revisiones?</summary>
            <p>La puedes ver, pero todavía no se puede solicitar. La ficha muestra qué revisiones faltan.</p>
          </details>
          <details>
            <summary>Todavía no tengo correo del Tec, ¿puedo registrarme?</summary>
            <p>Sí. Si aún no tienes correo institucional, una persona del equipo revisa tu caso a mano.</p>
          </details>
          <details>
            <summary>¿Aterriza es un servicio oficial del Tec?</summary>
            <p>No. Es un proyecto de estudiantes y no tiene respaldo oficial de la universidad.</p>
          </details>
        </div>
      </section>
    </>
  )
}
