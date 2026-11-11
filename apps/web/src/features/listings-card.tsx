import './search.css'
import { Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { ListingCard } from '@aterriza/contracts'
import { VerifiedBadge } from '../design/brand'
import { PriceAlertNote } from '../design/ui'
import { KIND_LABEL, money } from '../lib/format'

/** `from` guarda la búsqueda con sus filtros para que "Volver a resultados" regrese a ella. */
export function ListingCardView({ listing: l, onHover, from }: { listing: ListingCard; onHover?: (id: string | null) => void; from?: string }) {
  const onFoot = l.minutesWalk <= l.minutesTransit
  const nearest = Math.min(l.minutesWalk, l.minutesTransit)
  return (
    <Link to={`/viviendas/${l.id}`} state={from ? { from } : undefined} className="card" onMouseEnter={() => onHover?.(l.id)} onMouseLeave={() => onHover?.(null)}>
      <div className="card__media">
        {l.photo && <img src={l.photo.url} alt={l.photo.alt} loading="lazy" />}
        <div className="card__badge">
          <VerifiedBadge met={l.metCount} />
        </div>
      </div>
      <h3 className="card__title">{l.title}</h3>
      <p className="card__price">
        <b className="figure">{money(l.monthlyRentMxn)}</b>
        <span className="muted small">al mes</span>
      </p>
      <p className="card__real">Cerca de {money(l.estimatedMonthlyMxn)} con gastos (estimado)</p>
      <p className="card__near">
        {KIND_LABEL[l.kind]} en {l.zoneName}, a {nearest} min {onFoot ? 'a pie' : 'en transporte'} del campus
      </p>
      {l.reviewCount > 0 && (
        <p className="card__meta">
          <Star weight="fill" size={14} aria-hidden /> {l.rating} de {l.reviewCount} {l.reviewCount === 1 ? 'estancia comprobada' : 'estancias comprobadas'}
        </p>
      )}
      {l.priceAlert && <PriceAlertNote alert={l.priceAlert} compact />}
    </Link>
  )
}

/** Mantiene la forma de la cuadrícula mientras llegan los datos. */
export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid" role="status" aria-busy="true">
      <span className="sr-only">Buscando viviendas…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton__card" aria-hidden>
          <div className="skeleton__media" />
          <div className="skeleton__line" />
          <div className="skeleton__line" />
        </div>
      ))}
    </div>
  )
}
