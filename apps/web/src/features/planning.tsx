import './planning.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { BudgetEstimate, ChecklistItem, Guide, ListingDetail } from '@aterriza/contracts'
import { Empty, ErrorNote, LinkButton, Loading, Note, Page, Select, TextInput, Toggle } from '../design/ui'
import { api } from '../lib/api'
import { MONTHS, dateOnly, money } from '../lib/format'
import { useSession } from '../lib/session'

export function BudgetPage() {
  const [params] = useSearchParams()
  const listingId = params.get('vivienda')
  const listing = useQuery({ queryKey: ['listing-budget', listingId], queryFn: () => api.get<ListingDetail>(`/listings/${listingId}`), enabled: Boolean(listingId) })
  const [rent, setRent] = useState('10000')
  const [arrivalMonth, setArrival] = useState(8)
  const [usesAc, setAc] = useState(true)
  const [international, setInternational] = useState(true)
  const [utilities, setUtilities] = useState(false)
  const [near, setNear] = useState(false)

  // El último resultado se queda en pantalla mientras llega el nuevo: así no parpadea al cambiar un dato.
  const [e, setResult] = useState<BudgetEstimate | null>(null)
  const estimate = useMutation({ mutationFn: (body: object) => api.post<BudgetEstimate>('/budget/estimate', body), onSuccess: setResult })
  const { mutate } = estimate
  const rentNumber = Math.max(0, Number(rent) || 0)
  useEffect(() => {
    const base = { arrivalMonth, usesAc, international }
    const handle = setTimeout(() => {
      mutate(listingId ? { ...base, listingId } : { ...base, monthlyRent: rentNumber, utilitiesIncluded: utilities, minutesTransit: near ? 10 : 25 })
    }, 200)
    return () => clearTimeout(handle)
  }, [listingId, rentNumber, arrivalMonth, usesAc, international, utilities, near, mutate])

  const fromListing = e ? e.firstMonthTotalMxn - e.estimatedShareMxn : 0
  return (
    <Page title="Tu primer mes, sin sorpresas" lead="Lo que nadie te avisa: el depósito, la luz con aire acondicionado, los traslados y las comisiones de tu banco.">
      <div className="budget">
        <form className="panel form" onSubmit={(ev) => ev.preventDefault()}>
          {listing.data ? (
            <Note title={listing.data.title}>
              <p>{money(listing.data.monthlyRentMxn)} al mes. <Link to="/presupuesto">Usar otra renta</Link></p>
            </Note>
          ) : (
            <>
              <TextInput label="Renta al mes (MXN)" type="number" min={0} step={500} value={rent} onChange={(ev) => setRent(ev.target.value)} />
              <Toggle label="Los servicios vienen incluidos" checked={utilities} onChange={(ev) => setUtilities(ev.target.checked)} />
              <Toggle label="Vivo a menos de 15 minutos del campus" checked={near} onChange={(ev) => setNear(ev.target.checked)} />
            </>
          )}
          <Select label="Mes de llegada" value={arrivalMonth} onChange={(ev) => setArrival(Number(ev.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <Toggle label="Voy a usar aire acondicionado" checked={usesAc} onChange={(ev) => setAc(ev.target.checked)} />
          <Toggle label="Vengo de otro país" checked={international} onChange={(ev) => setInternational(ev.target.checked)} />
        </form>

        <div className="stack" aria-live="polite">
          <ErrorNote error={estimate.error} />
          {e && (
            <>
              <div className="panel">
                <div className="totals">
                  <div>
                    <p className="figure total__n">{money(e.firstMonthTotalMxn)}</p>
                    <p className="total__l">Primer mes, con depósito e instalación</p>
                  </div>
                  <div>
                    <p className="figure total__n">{money(e.typicalMonthTotalMxn)}</p>
                    <p className="total__l">Un mes típico después</p>
                  </div>
                </div>
                <div className="split">
                  <div className="split__bar" aria-hidden>
                    {fromListing > 0 && <div className="split__seg split__seg--a" style={{ flexGrow: fromListing }} />}
                    <div className="split__seg split__seg--b" style={{ flexGrow: e.estimatedShareMxn }} />
                  </div>
                  <div className="split__legend">
                    {fromListing > 0 && <span><i className="swatch swatch--a" aria-hidden />Renta y depósito: {money(fromListing)}</span>}
                    <span><i className="swatch swatch--b" aria-hidden />Estimación: {money(e.estimatedShareMxn)}</span>
                  </div>
                </div>
                <table className="table ledger">
                  <thead>
                    <tr>
                      <th scope="col">Concepto</th>
                      <th scope="col" className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.label}
                          {l.firstMonthOnly && <span className="ledger__once">solo el primer mes</span>}
                          {l.source === 'estimate' && <span className="ledger__tag">estimado</span>}
                          {l.note && <span className="ledger__note">{l.note}</span>}
                        </td>
                        <td className="num">{money(l.amountMxn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted mt-3">Las estimaciones son supuestos de trabajo del equipo, aún sin validar con recibos reales. Tómalas como orientación.</p>
              </div>
              {e.alerts.map((a) => (
                <Note key={a.id} tone="warning" title={a.title}>{a.detail}</Note>
              ))}
            </>
          )}
        </div>
      </div>
    </Page>
  )
}

export function GuidesPage() {
  const { me } = useSession()
  const { data, isLoading, error } = useQuery({ queryKey: ['guides'], queryFn: () => api.get<Guide[]>('/guides') })
  const categories = [...new Set(data?.map((g) => g.category))]
  return (
    <Page
      title="Guías para llegar bien"
      lead="Todo en un solo lugar, en vez de buscarlo en diez grupos de WhatsApp."
      actions={me ? <LinkButton to="/checklist">Ver mi checklist</LinkButton> : undefined}
    >
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      <div className="guides">
        {categories.map((cat) => (
          <section key={cat} className="guides__cat">
            <h2>{cat}</h2>
            <div>
              {data?.filter((g) => g.category === cat).map((g) => (
                <Link key={g.id} to={`/guias/${g.slug}`} className="guideitem">
                  <h3 className="guideitem__title">{g.title}</h3>
                  <p className="muted">{g.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}

/** Solo interpreta títulos y listas. Nunca genera HTML desde el texto. */
function Prose({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = (key: number) => {
    if (list.length > 0) {
      const items = list
      blocks.push(<ul key={`u${key}`}>{items.map((i) => <li key={i}>{i}</li>)}</ul>)
      list = []
    }
  }
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('- ')) {
      list.push(line.slice(2))
      return
    }
    flush(i)
    if (line.startsWith('## ')) blocks.push(<h2 key={i}>{line.slice(3)}</h2>)
    else if (line) blocks.push(<p key={i}>{line}</p>)
  })
  flush(-1)
  return <div className="prose">{blocks}</div>
}

export function GuidePage() {
  const { slug } = useParams()
  const { data, isLoading, error } = useQuery({ queryKey: ['guide', slug], queryFn: () => api.get<Guide>(`/guides/${slug}`) })
  if (isLoading) return <div className="page"><Loading /></div>
  if (error || !data) return <div className="page page--narrow"><Empty as="h1" title="No encontramos esta guía"><LinkButton to="/guias" variant="secondary">Ver todas las guías</LinkButton></Empty></div>
  return (
    <Page narrow title={data.title} lead={data.summary}>
      <Prose text={data.body} />
      <p className="small muted mt-8">Última revisión: {dateOnly(data.reviewedOn)}. Contenido de orientación general.</p>
      <p className="mt-4"><Link to="/guias">Volver a las guías</Link></p>
    </Page>
  )
}

export function ChecklistPage() {
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['checklist'], queryFn: () => api.get<ChecklistItem[]>('/checklist') })
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.put(`/checklist/${id}`, { done }),
    onMutate: ({ id, done }) => client.setQueryData<ChecklistItem[]>(['checklist'], (prev) => prev?.map((t) => (t.id === id ? { ...t, done } : t))),
    onError: () => client.invalidateQueries({ queryKey: ['checklist'] }),
  })
  const done = data?.filter((t) => t.done).length ?? 0
  const total = data?.length ?? 0
  const phases: ['before' | 'week1', string][] = [['before', 'Antes de viajar'], ['week1', 'Tu primera semana']]
  return (
    <Page narrow title="Mi checklist" lead="Lo que tienes que resolver antes de llegar y en tus primeros días.">
      <ErrorNote error={error ?? toggle.error} />
      {isLoading && <Loading />}
      {total > 0 && (
        <div className="stack stack--lg">
          <div>
            <p><b>{done} de {total}</b> listas</p>
            <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Avance del checklist">
              <div className="progress__fill" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>
          {phases.map(([phase, label]) => (
            <Fragment key={phase}>
              <section className="checklist__phase">
                <h2>{label}</h2>
                <div className="tasks">
                  {data?.filter((t) => t.phase === phase).map((t) => (
                    <label key={t.id} className={`task ${t.done ? 'is-done' : ''}`}>
                      <input type="checkbox" checked={t.done} onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })} />
                      <span>
                        <span className="task__title">{t.title}</span>
                        <span className="task__hint">{t.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </Fragment>
          ))}
        </div>
      )}
    </Page>
  )
}
