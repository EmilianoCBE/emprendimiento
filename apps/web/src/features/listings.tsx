import './listing.css'
import { Faders, MapTrifold, ListBullets, Star } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LISTING_KINDS, REPORT_REASONS, REPORT_REASON_LABEL, type ListingCard, type ListingDetail, type Paged, type ReportReason, type Zone } from '@aterriza/contracts'
import { Seal } from '../design/brand'
import { Button, CriteriaList, Empty, ErrorNote, LinkButton, Loading, Note, PriceAlertNote, Select, TextArea, TextInput, Toggle } from '../design/ui'
import { api } from '../lib/api'
import { KIND_LABEL, dateOnly, money } from '../lib/format'
import { useSession } from '../lib/session'
import { MentorCardView } from './community-card'
import { ListingCardView, ListingGridSkeleton } from './listings-card'

// ---------- Mapa ----------
const TEC: [number, number] = [25.6515, -100.2895]

function ResultsMap({ items, active }: { items: ListingCard[]; active: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!ref.current || map.current) return
    const m = L.map(ref.current, { scrollWheelZoom: false }).setView(TEC, 14)
    // Servidor público de OSM: suficiente para la demo. Para producción hay que contratar un proveedor de mapas (docs/08-seguridad.md).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    L.marker(TEC, {
      icon: L.divIcon({ className: '', html: '<span class="mappin mappin--campus">Campus</span>', iconSize: [0, 0] }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const group = layer.current
    if (!group || !map.current) return
    group.clearLayers()
    for (const l of items) {
      const span = document.createElement('span')
      const danger = l.priceAlert?.severity === 'danger'
      const tone = danger ? 'mappin--alert' : l.level === 'verified' ? '' : 'mappin--part'
      span.className = `mappin ${tone} ${active === l.id ? 'is-active' : ''}`
      // textContent: nunca interpretar datos como HTML.
      span.textContent = `${danger ? '! ' : ''}${money(l.monthlyRentMxn)}`
      const marker = L.marker([l.approxLat, l.approxLng], {
        icon: L.divIcon({ className: '', html: span, iconSize: [0, 0] }),
        title: `${l.title}, ${money(l.monthlyRentMxn)}, ${l.metCount} de 4 revisiones${danger ? ', precio sospechoso' : ''}`,
        zIndexOffset: active === l.id ? 1000 : 0,
      })
      marker.on('click', () => navigate(`/viviendas/${l.id}`))
      marker.addTo(group)
    }
  }, [items, active, navigate])

  return (
    <div className="mapwrap">
      <div ref={ref} className="mapwrap__map" role="region" aria-label="Mapa con la ubicación aproximada de las viviendas" />
      <div className="maplegend">
        <span><i aria-hidden>$</i> 4 revisiones</span>
        <span><i className="part" aria-hidden>$</i> Revisión incompleta</span>
        <span><i className="alert" aria-hidden>!</i> Precio sospechoso</span>
      </div>
    </div>
  )
}

// ---------- Búsqueda ----------
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [hovered, setHovered] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const queryString = params.toString()
  const { data, isLoading, error } = useQuery({
    queryKey: ['listings', queryString],
    queryFn: () => api.get<Paged<ListingCard>>(`/listings?pageSize=24&${queryString}`),
    placeholderData: (prev) => prev,
  })

  const set = (key: string, value: string | boolean) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === false) next.delete(key)
    else next.set(key, String(value))
    next.delete('page')
    setParams(next, { replace: true })
  }
  const flag = (key: string) => params.get(key) === 'true'
  const hasFilters = [...params.keys()].some((k) => k !== 'sort')
  const selectedZone = zones.data?.find((z) => z.slug === params.get('zone'))

  const activeFilters = [...params.keys()].filter((k) => k !== 'sort').length

  return (
    <div className="searchview" data-view={view} data-filters={filtersOpen ? 'open' : 'closed'}>
      <div className="results">
        <h1>Viviendas cerca del campus</h1>

        <div className="results__toolbar">
          <Button variant="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
            <Faders size={20} aria-hidden /> Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <Button variant="secondary" onClick={() => setView(view === 'list' ? 'map' : 'list')}>
            {view === 'list' ? <MapTrifold size={20} aria-hidden /> : <ListBullets size={20} aria-hidden />} {view === 'list' ? 'Ver mapa' : 'Ver lista'}
          </Button>
        </div>

        <div className="filters__panel">
          <div className="filters">
            <Select label="Zona" value={params.get('zone') ?? ''} onChange={(e) => set('zone', e.target.value)}>
              <option value="">Todas</option>
              {zones.data?.map((z) => (
                <option key={z.id} value={z.slug}>
                  {z.name}
                  {z.medianRentMxn ? `, mediana ${money(z.medianRentMxn)}` : ''}
                </option>
              ))}
            </Select>
            <TextInput label="Renta máxima" type="number" min={0} step={500} placeholder="Sin límite" value={params.get('maxRent') ?? ''} onChange={(e) => set('maxRent', e.target.value)} />
            <Select label="Al campus" value={params.get('maxMinutes') ?? ''} onChange={(e) => set('maxMinutes', e.target.value)}>
              <option value="">Sin importar</option>
              <option value="10">Hasta 10 min</option>
              <option value="15">Hasta 15 min</option>
              <option value="25">Hasta 25 min</option>
            </Select>
            <Select label="Tipo" value={params.get('kind') ?? ''} onChange={(e) => set('kind', e.target.value)}>
              <option value="">Todos</option>
              {LISTING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div className="filters__flags">
            <Toggle label="Solo con 4 revisiones" checked={flag('verifiedOnly')} onChange={(e) => set('verifiedOnly', e.target.checked)} />
            <Toggle label="Contrato por semestre" checked={flag('semester')} onChange={(e) => set('semester', e.target.checked)} />
            <Toggle label="Amueblada" checked={flag('furnished')} onChange={(e) => set('furnished', e.target.checked)} />
            <Toggle label="Servicios incluidos" checked={flag('utilities')} onChange={(e) => set('utilities', e.target.checked)} />
          </div>
        </div>

        {selectedZone && (
          <div className="mt-4">
            <Note title={`Sobre ${selectedZone.name}`}>
              {selectedZone.transitNote} {selectedZone.lifeNote}
            </Note>
          </div>
        )}

        <div className="results__bar">
          <p aria-live="polite">
            <b>{data?.total ?? 0}</b> {data?.total === 1 ? 'vivienda' : 'viviendas'}
          </p>
          <div className="results__sort">
            <label className="sr-only" htmlFor="sort">
              Ordenar por
            </label>
            <select id="sort" className="input" value={params.get('sort') ?? 'trust'} onChange={(e) => set('sort', e.target.value)}>
              <option value="trust">Más revisadas primero</option>
              <option value="price_asc">Menor renta</option>
              <option value="price_desc">Mayor renta</option>
              <option value="distance">Más cerca del campus</option>
            </select>
          </div>
        </div>

        <ErrorNote error={error} />
        {isLoading && <ListingGridSkeleton />}
        {data?.items.length === 0 && (
          <Empty title="Ninguna vivienda cumple con estos filtros">
            <p className="empty__body">Prueba a subir tu renta máxima o a quitar un filtro.</p>
            {hasFilters && (
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Quitar filtros
              </Button>
            )}
          </Empty>
        )}
        {data && data.items.length > 0 && <h2 className="sr-only">Resultados</h2>}
        <div className="grid">
          {data?.items.map((l) => (
            <ListingCardView key={l.id} listing={l} onHover={setHovered} />
          ))}
        </div>
      </div>
      <ResultsMap items={data?.items ?? []} active={hovered} />
    </div>
  )
}

// ---------- Ficha ----------
export function ListingPage() {
  const { id } = useParams()
  const { me } = useSession()
  const { data: l, isLoading, error } = useQuery({
    queryKey: ['listing', id, me?.id],
    queryFn: () => api.get<ListingDetail>(`/listings/${id}`),
  })
  const included = useMemo(() => l?.costItems.filter((c) => c.included) ?? [], [l])
  const excluded = useMemo(() => l?.costItems.filter((c) => !c.included) ?? [], [l])

  if (isLoading) return <div className="page"><div className="skeleton__media" /><Loading /></div>
  if (error || !l) {
    return (
      <div className="page page--narrow">
        <Empty as="h1" title="Esta vivienda no está disponible">
          <p className="empty__body">Puede estar en revisión o ya no publicarse.</p>
          <LinkButton to="/viviendas" variant="secondary">Ver otras viviendas</LinkButton>
        </Empty>
      </div>
    )
  }

  const [main, ...rest] = l.photos
  return (
    <div className="page">
      <div className={`gallery ${rest.length === 0 ? 'gallery--one' : ''}`}>
        {main && <img className="gallery__main" src={main.url} alt={main.alt} />}
        {rest.length > 0 && (
          <div className="gallery__rest">
            {rest.slice(0, 2).map((p) => (
              <img key={p.id} src={p.url} alt={p.alt} loading="lazy" />
            ))}
          </div>
        )}
      </div>

      <div className="detail">
        <div className="detail__head">
          <p className="detail__kind">
            {KIND_LABEL[l.kind]} en {l.zoneName}
          </p>
          <h1 className="detail__title">{l.title}</h1>

          {l.priceAlert && (
            <div className="detail__alert">
              <PriceAlertNote alert={l.priceAlert} />
              <p className="small muted mt-2">
                Mediana {l.priceAlert.scope === 'zone' ? 'de la zona' : 'de la ciudad'}: {money(l.priceAlert.medianMxn)} al mes.
              </p>
            </div>
          )}

        </div>

        <div className="detail__main">
          <dl className="facts">
            <div><dt>Caminando al campus</dt><dd>{l.minutesWalk} min</dd></div>
            <div><dt>En transporte</dt><dd>{l.minutesTransit} min</dd></div>
            <div><dt>Plazo mínimo</dt><dd>{l.minMonths} meses</dd></div>
            <div><dt>Contrato por semestre</dt><dd>{l.semesterContract ? 'Sí' : 'No'}</dd></div>
            <div><dt>Depósito</dt><dd>{l.depositMonths === 0 ? 'Sin depósito' : `${l.depositMonths} ${l.depositMonths === 1 ? 'mes' : 'meses'}`}</dd></div>
            <div><dt>Amueblada</dt><dd>{l.furnished ? 'Sí' : 'No'}</dd></div>
            <div><dt>Aire acondicionado</dt><dd>{l.airConditioning ? 'Sí' : 'No'}</dd></div>
            <div><dt>Disponible desde</dt><dd>{dateOnly(l.availableFrom)}</dd></div>
          </dl>

          <section className="detail__section">
            <h2>Qué revisamos</h2>
            <CriteriaList criteria={l.verification.criteria} columns />
          </section>

          <section className="detail__section">
            <h2>Tu costo real</h2>
            <div className="costbox">
              <div className="totals">
                <div>
                  <p className="figure total__n">{money(l.budget.firstMonthTotalMxn)}</p>
                  <p className="total__l">Primer mes estimado, con depósito e instalación</p>
                </div>
                <div>
                  <p className="figure total__n">{money(l.budget.typicalMonthTotalMxn)}</p>
                  <p className="total__l">Un mes típico estimado</p>
                </div>
              </div>
              <p className="small muted mt-4">Calculado para alguien que llega de otro país en agosto. Lo que no viene del anuncio es una estimación.</p>
              <div className="mt-4">
                <LinkButton to={`/presupuesto?vivienda=${l.id}`} variant="secondary">Ajustar a mi caso</LinkButton>
              </div>
            </div>
          </section>

          <section className="detail__section">
            <h2>Lo que incluye la renta y lo que no</h2>
            <div className="includes">
              <div>
                <h3>Incluido</h3>
                <ul>
                  {included.length === 0 && <li className="muted">Nada adicional</li>}
                  {included.map((c) => <li key={c.label}>{c.label}</li>)}
                </ul>
              </div>
              <div>
                <h3>Se paga aparte</h3>
                <ul>
                  {excluded.length === 0 && <li className="muted">Nada adicional</li>}
                  {excluded.map((c) => (
                    <li key={c.label}>
                      {c.label}
                      {c.estimateMxn !== null && <span className="muted">cerca de {money(c.estimateMxn)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="detail__section">
            <h2>Sobre este lugar</h2>
            <p className="measure">{l.description}</p>
            <p className="muted small mt-2">Publicada por {l.landlordName}.</p>
          </section>

          <ReviewsSection listing={l} />

          {l.mentors.length > 0 && (
            <section className="detail__section">
              <h2>Pregúntale a quien conoce {l.zoneName}</h2>
              <div className="mentors mentors--stacked">
                {l.mentors.map((m) => (
                  <MentorCardView key={m.id} mentor={m} headingLevel="h3" />
                ))}
              </div>
            </section>
          )}

          <ReportSection listing={l} />
        </div>

        <aside className="aside" aria-label="Solicitar esta vivienda">
          <div className="aside__top">
            <div>
              <p className="figure aside__price">{money(l.monthlyRentMxn)}</p>
              <p className="muted small mt-1">al mes</p>
            </div>
            <Seal met={l.verification.metCount} size={80} stamp={l.verification.level === 'verified'} />
          </div>
          {l.rating !== null && (
            <p className="aside__score">
              <Star weight="fill" size={16} aria-hidden /> {l.rating} con {l.reviewCount} {l.reviewCount === 1 ? 'estancia comprobada' : 'estancias comprobadas'}
            </p>
          )}
          <BookingPanel listing={l} />
        </aside>
      </div>
    </div>
  )
}

function BookingPanel({ listing: l }: { listing: ListingDetail }) {
  const { me } = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [startDate, setStart] = useState('2027-01-11')
  const [endDate, setEnd] = useState('2027-06-18')
  const [message, setMessage] = useState('')
  const [ack, setAck] = useState(false)
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/bookings', { listingId: l.id, startDate, endDate, message, fraudNoticeAck: ack }),
    onSuccess: ({ id }) => {
      void client.invalidateQueries({ queryKey: ['bookings'] })
      navigate(`/solicitudes/${id}`)
    },
  })

  if (l.viewer.isOwner) return <Note title="Esta es tu vivienda."><Link to="/mis-viviendas">Administrarla</Link></Note>
  if (l.viewer.activeBookingId) return <LinkButton to={`/solicitudes/${l.viewer.activeBookingId}`}>Ver mi solicitud</LinkButton>
  if (l.exactAddress) return <Note title="Dirección">{l.exactAddress}</Note>
  const missing = 4 - l.verification.metCount
  if (missing > 0 || l.occupied) {
    return (
      <Note tone="warning" title="Aún no se puede solicitar">
        <p>{l.occupied ? 'Esta vivienda está ocupada en este momento.' : `Le ${missing === 1 ? 'falta 1 revisión' : `faltan ${missing} revisiones`} de las 4 que pedimos.`}</p>
        <p className="mt-2"><Link to="/viviendas?verifiedOnly=true">Ver viviendas con las 4 revisiones</Link></p>
      </Note>
    )
  }
  if (!me) {
    return (
      <>
        <LinkButton to={`/entrar?volver=/viviendas/${l.id}`}>Inicia sesión para solicitarla</LinkButton>
        <p className="small muted">Solicitar no tiene costo. Valida tu matrícula y también podrás hablar con mentores.</p>
      </>
    )
  }
  if (l.viewer.blockers.length > 0) {
    return (
      <Note tone="warning" title="Todavía no puedes solicitarla">
        <ul className="note__list">
          {l.viewer.blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
        {me.role === 'student' && me.studentStatus !== 'verified' && <p className="mt-2"><Link to="/cuenta">Validar mi matrícula</Link></p>}
      </Note>
    )
  }
  if (!open) {
    return (
      <>
        <Button onClick={() => setOpen(true)}>Solicitar vivienda</Button>
        <p className="small muted">Solicitar no te compromete ni tiene costo. Aterriza no cobra ni recibe pagos de renta.</p>
      </>
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="form__row">
        <TextInput label="Entrada" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
        <TextInput label="Salida" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
      </div>
      <TextArea label="Preséntate" hint="Tu programa, cuándo llegas y qué te gustaría preguntar." value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={800} />
      <Note tone="warning" title="Antes de solicitar">
        <p>Aterriza no procesa pagos. No transfieras dinero sin ver el lugar por videollamada y sin un contrato firmado con recibo.</p>
      </Note>
      <Toggle label="Entiendo y no voy a pagar por fuera sin contrato." checked={ack} onChange={(e) => setAck(e.target.checked)} />
      <ErrorNote error={create.error} />
      <Button type="submit" busy={create.isPending} disabled={!ack}>
        {create.isPending ? 'Enviando…' : 'Enviar solicitud'}
      </Button>
    </form>
  )
}

function ReviewsSection({ listing: l }: { listing: ListingDetail }) {
  const client = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const submit = useMutation({
    mutationFn: () => api.post(`/listings/${l.id}/reviews`, { rating, comment }),
    onSuccess: () => {
      setComment('')
      void client.invalidateQueries({ queryKey: ['listing', l.id] })
    },
  })
  return (
    <section className="detail__section">
      <h2>Reseñas de estancias comprobadas</h2>
      {l.reviews.length === 0 && <p className="muted">Todavía nadie con estancia comprobada ha dejado reseña.</p>}
      {l.reviews.map((r) => (
        <article key={r.id} className="review">
          <div className="review__head">
            <span className="review__who">
              <span className="aside__score"><Star weight="fill" size={16} aria-hidden /> {r.rating}<span className="sr-only"> de 5</span></span>
              {r.authorName}
            </span>
            <span className="review__stay">Estancia comprobada, {r.stayLabel}</span>
          </div>
          <p>{r.comment}</p>
        </article>
      ))}
      {l.viewer.canReview && (
        <form
          className="form panel mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit.mutate()
          }}
        >
          <h3>Cuenta cómo fue tu estancia</h3>
          <Select label="Calificación" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} de 5</option>)}
          </Select>
          <TextArea label="Tu experiencia" hint="Entre 20 y 600 caracteres. Cuéntalo tal cual fue." value={comment} onChange={(e) => setComment(e.target.value)} required minLength={20} maxLength={600} />
          <ErrorNote error={submit.error} />
          <div><Button type="submit" busy={submit.isPending}>Publicar reseña</Button></div>
        </form>
      )}
    </section>
  )
}

function ReportSection({ listing: l }: { listing: ListingDetail }) {
  const { me } = useSession()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('fake_listing')
  const [detail, setDetail] = useState('')
  const report = useMutation({
    mutationFn: () => api.post(`/listings/${l.id}/reports`, { reason, detail: detail || undefined }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['listing', l.id] }),
  })
  if (!me || l.viewer.isOwner) return null
  if (l.viewer.hasReported || report.isSuccess) {
    return (
      <section className="detail__section">
        <Note tone="ok" title="Recibimos tu reporte">Lo revisaremos. Con tres reportes de personas distintas, la vivienda deja de aparecer mientras se revisa.</Note>
      </section>
    )
  }
  return (
    <section className="detail__section">
      {!open ? (
        <Button variant="quiet" onClick={() => setOpen(true)}>Reportar un problema con esta vivienda</Button>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            report.mutate()
          }}
        >
          <h2>Reportar esta vivienda</h2>
          <Select label="¿Qué pasó?" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>)}
          </Select>
          <TextArea label="Detalles (opcional)" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={600} />
          <ErrorNote error={report.error} />
          <div className="btnrow">
            <Button type="submit" variant="danger" busy={report.isPending}>Enviar reporte</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </section>
  )
}
