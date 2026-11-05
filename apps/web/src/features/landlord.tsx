import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LISTING_KINDS, listingInputSchema, type ListingInput, type ListingStatus, type OwnedListing, type Zone } from '@aterriza/contracts'
import { Seal } from '../design/brand'
import { Button, CriteriaList, Empty, ErrorNote, LinkButton, Loading, Note, Page, Select, TextArea, TextInput, Toggle } from '../design/ui'
import { ApiError, api } from '../lib/api'
import { KIND_LABEL, LISTING_STATUS_LABEL, money } from '../lib/format'

const STATUS_CHIP: Record<ListingStatus, string> = {
  draft: '',
  pending_review: 'chip--wait',
  active: 'chip--ok',
  under_review: 'chip--stop',
  archived: '',
}

const useMine = () => useQuery({ queryKey: ['my-listings'], queryFn: () => api.get<OwnedListing[]>('/me/listings') })

export function MyListingsPage() {
  const { data, isLoading, error } = useMine()
  return (
    <Page title="Mis viviendas" lead="Solo se publican después de que revisamos sus datos. Con las cuatro revisiones, los estudiantes podrán solicitarlas." actions={<LinkButton to="/mis-viviendas/nueva">Publicar una vivienda</LinkButton>}>
      <ErrorNote error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty title="Aún no publicas ninguna vivienda"><LinkButton to="/mis-viviendas/nueva" variant="secondary">Publicar la primera</LinkButton></Empty>}
      <div className="rowlist">
        {data?.map((l) => (
          <Link key={l.id} to={`/mis-viviendas/${l.id}`} className="rowcard">
            {l.photo ? <img src={l.photo.url} alt="" /> : <div className="rowcard__ph" />}
            <div>
              <h3>{l.title}</h3>
              <p className="muted small">
                {l.zoneName}, {money(l.monthlyRentMxn)} al mes, {l.metCount} de 4 revisiones
                {l.pendingBookings > 0 && <b style={{ color: 'var(--sierra)' }}>. {l.pendingBookings} {l.pendingBookings === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}</b>}
              </p>
            </div>
            <span className={`chip ${STATUS_CHIP[l.status]}`}>{LISTING_STATUS_LABEL[l.status]}</span>
          </Link>
        ))}
      </div>
    </Page>
  )
}

const EMPTY: ListingInput = {
  zoneId: '',
  title: '',
  description: '',
  kind: 'room',
  monthlyRentMxn: 9000,
  depositMonths: 1,
  minMonths: 5,
  semesterContract: true,
  minutesWalk: 15,
  minutesTransit: 10,
  furnished: true,
  utilitiesIncluded: false,
  airConditioning: true,
  exactAddress: '',
  availableFrom: '2027-01-05',
  costItems: [],
}

export function ListingEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const mine = useMine()
  const existing = mine.data?.find((l) => l.id === id)
  const [form, setForm] = useState<ListingInput>(EMPTY)
  const [clientError, setClientError] = useState<string[] | null>(null)

  useEffect(() => {
    if (existing) setForm(existing.input)
  }, [existing])

  const put = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const refresh = () => client.invalidateQueries({ queryKey: ['my-listings'] })

  const save = useMutation({
    mutationFn: (input: ListingInput) => (id ? api.patch(`/listings/${id}`, input) : api.post<{ id: string }>('/listings', input)),
    onSuccess: async (res) => {
      await refresh()
      if (!id) navigate(`/mis-viviendas/${(res as { id: string }).id}`, { replace: true })
    },
  })
  const submitForReview = useMutation({ mutationFn: () => api.post(`/listings/${id}/submit`), onSuccess: refresh })
  const archive = useMutation({
    mutationFn: () => api.post(`/listings/${id}/archive`),
    onSuccess: async () => {
      await refresh()
      navigate('/mis-viviendas')
    },
  })
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('alt', form.title)
      body.append('file', file)
      return api.post(`/listings/${id}/photos`, body)
    },
    onSuccess: refresh,
  })
  const removePhoto = useMutation({ mutationFn: (photoId: string) => api.del(`/listings/${id}/photos/${photoId}`), onSuccess: refresh })

  if (id && mine.isLoading) return <div className="page"><Loading /></div>
  if (id && !existing) return <div className="page page--narrow"><Empty title="No encontramos esta vivienda"><LinkButton to="/mis-viviendas" variant="secondary">Ver mis viviendas</LinkButton></Empty></div>

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    const parsed = listingInputSchema.safeParse(form)
    if (!parsed.success) {
      setClientError(parsed.error.issues.map((i) => i.message))
      return
    }
    setClientError(null)
    save.mutate(parsed.data)
  }
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload.mutate(file)
    e.target.value = ''
  }

  const num = (key: 'monthlyRentMxn' | 'depositMonths' | 'minMonths' | 'minutesWalk' | 'minutesTransit') => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => put(key, Number(e.target.value)),
    type: 'number' as const,
    min: 0,
  })

  return (
    <Page title={existing ? existing.title : 'Publicar una vivienda'} lead={existing ? LISTING_STATUS_LABEL[existing.status] : 'Entre más clara la información, más rápido la revisamos.'}>
      <div className="twocol">
        <form className="panel form" onSubmit={onSave}>
          <Select label="Zona" value={form.zoneId} onChange={(e) => put('zoneId', e.target.value)} required>
            <option value="" disabled>Elige una zona</option>
            {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
          <TextInput label="Título" value={form.title} onChange={(e) => put('title', e.target.value)} required maxLength={90} />
          <TextArea label="Descripción" hint="Con quién se comparte, qué tiene y qué tan cerca queda del transporte." value={form.description} onChange={(e) => put('description', e.target.value)} required maxLength={2000} />
          <TextInput label="Dirección exacta" hint="No se muestra hasta que aceptes una solicitud." value={form.exactAddress} onChange={(e) => put('exactAddress', e.target.value)} required maxLength={200} />
          <div className="form__row">
            <Select label="Tipo" value={form.kind} onChange={(e) => put('kind', e.target.value as ListingInput['kind'])}>
              {LISTING_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
            <TextInput label="Renta al mes (MXN)" step={100} {...num('monthlyRentMxn')} />
            <TextInput label="Depósito (meses)" step={0.5} {...num('depositMonths')} />
          </div>
          <div className="form__row">
            <TextInput label="Plazo mínimo (meses)" {...num('minMonths')} />
            <TextInput label="Minutos a pie al campus" {...num('minutesWalk')} />
            <TextInput label="Minutos en transporte" {...num('minutesTransit')} />
            <TextInput label="Disponible desde" type="date" value={form.availableFrom} onChange={(e) => put('availableFrom', e.target.value)} />
          </div>
          <Toggle label="Contrato por semestre" checked={form.semesterContract} onChange={(e) => put('semesterContract', e.target.checked)} />
          <Toggle label="Amueblada" checked={form.furnished} onChange={(e) => put('furnished', e.target.checked)} />
          <Toggle label="Luz e internet incluidos en la renta" checked={form.utilitiesIncluded} onChange={(e) => put('utilitiesIncluded', e.target.checked)} />
          <Toggle label="Tiene aire acondicionado" checked={form.airConditioning} onChange={(e) => put('airConditioning', e.target.checked)} />

          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="form">
            <legend className="field__label" style={{ marginBottom: 8 }}>Qué incluye y qué se paga aparte</legend>
            {form.costItems.map((item, i) => (
              <div className="costrow" key={i}>
                <input className="input" aria-label="Concepto" placeholder="Por ejemplo, agua" value={item.label} onChange={(e) => put('costItems', form.costItems.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)))} />
                <Toggle label="Incluido" checked={item.included} onChange={(e) => put('costItems', form.costItems.map((c, j) => (j === i ? { ...c, included: e.target.checked } : c)))} />
                <input className="input" aria-label="Monto estimado al mes" type="number" min={0} placeholder="Estimado" disabled={item.included} value={item.estimateMxn ?? ''} onChange={(e) => put('costItems', form.costItems.map((c, j) => (j === i ? { ...c, estimateMxn: e.target.value ? Number(e.target.value) : null } : c)))} />
                <Button type="button" variant="quiet" onClick={() => put('costItems', form.costItems.filter((_, j) => j !== i))}>Quitar</Button>
              </div>
            ))}
            <div><Button type="button" variant="secondary" onClick={() => put('costItems', [...form.costItems, { label: '', included: true, estimateMxn: null }])}>Agregar concepto</Button></div>
          </fieldset>

          {clientError && <Note tone="danger" title="Revisa los datos"><ul className="note__list">{clientError.map((m) => <li key={m}>{m}</li>)}</ul></Note>}
          <ErrorNote error={save.error} />
          {save.isSuccess && id && <Note tone="ok" title="Cambios guardados">Si estaba publicada y cambiaste algo más que la fecha de disponibilidad, vuelve a revisión.</Note>}
          <div><Button type="submit" busy={save.isPending}>{id ? 'Guardar cambios' : 'Guardar borrador'}</Button></div>
        </form>

        {existing ? (
          <aside className="stack">
            <div className="panel stack">
              <div className="aside__top">
                <h2 style={{ fontSize: '1.8rem' }}>Revisiones</h2>
                <Seal met={existing.metCount} size={82} />
              </div>
              {existing.reviewNote && <Note tone="warning" title="Nota del equipo">{existing.reviewNote}</Note>}
              <CriteriaList criteria={existing.criteria} />
              {existing.status === 'draft' && (
                <>
                  <ErrorNote error={submitForReview.error} />
                  <Button onClick={() => submitForReview.mutate()} busy={submitForReview.isPending}>Enviar a revisión</Button>
                </>
              )}
              {existing.status === 'pending_review' && <Note title="La estamos revisando">Te avisaremos del resultado.</Note>}
              {existing.status === 'active' && <LinkButton to={`/viviendas/${existing.id}`} variant="secondary">Ver cómo se publica</LinkButton>}
            </div>
            <div className="panel stack">
              <h2 style={{ fontSize: '1.8rem' }}>Fotos</h2>
              <div className="photoedit">
                {existing.photos.map((p) => (
                  <div className="photoedit__item" key={p.id}>
                    <img src={p.url} alt={p.alt} />
                    <button type="button" onClick={() => removePhoto.mutate(p.id)} aria-label={`Quitar foto: ${p.alt}`}>Quitar</button>
                  </div>
                ))}
              </div>
              <TextInput label="Agregar foto" hint="JPG, PNG o WebP, hasta 5 MB. Si la vivienda está publicada, cambiar fotos la devuelve a revisión." type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={upload.isPending} />
              {upload.isPending && <p className="small" role="status">Subiendo foto…</p>}
              <ErrorNote error={upload.error ?? removePhoto.error} />
            </div>
            {(existing.status === 'active' || existing.status === 'draft') && (
              <div>
                <ErrorNote error={archive.error instanceof ApiError ? archive.error : null} />
                <Button variant="danger" onClick={() => archive.mutate()} busy={archive.isPending}>Archivar vivienda</Button>
              </div>
            )}
          </aside>
        ) : (
          <aside><Note title="Después de guardar">Podrás subir fotos y enviarla a revisión. No se publica nada hasta que la aprobemos.</Note></aside>
        )}
      </div>
    </Page>
  )
}
