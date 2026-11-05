import { Warning, WarningOctagon } from '@phosphor-icons/react'
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react'
import { Link } from 'react-router-dom'
import type { PriceAlert, Criterion, VerificationSummary } from '@aterriza/contracts'
import { CRITERIA, CRITERION_LABEL } from '@aterriza/contracts'
import { Check, X } from '@phosphor-icons/react'
import { ApiError } from '../lib/api'

export function Button({ variant = 'primary', busy, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean }) {
  return (
    <button className={`btn btn--${variant} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'primary', children }: { to: string; variant?: 'primary' | 'secondary' | 'quiet'; children: ReactNode }) {
  return (
    <Link to={to} className={`btn btn--${variant}`}>
      {children}
    </Link>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children(id, hint ? hintId : undefined)}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && <p className="field__error">{error}</p>}
    </div>
  )
}

export function TextInput({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <Field label={label} hint={hint}>{(id, d) => <input id={id} aria-describedby={d} className="input" {...rest} />}</Field>
}
export function TextArea({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return <Field label={label} hint={hint}>{(id, d) => <textarea id={id} aria-describedby={d} className="input input--area" {...rest} />}</Field>
}
export function Select({ label, hint, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <select id={id} aria-describedby={d} className="input" {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}
export function Toggle({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const api = error instanceof ApiError ? error : null
  const message = api?.message ?? 'Algo falló. Vuelve a intentar.'
  return (
    <div className="note note--danger" role="alert">
      <WarningOctagon size={22} weight="fill" aria-hidden />
      <div>
        <p className="note__title">{message}</p>
        {api && api.details.length > 0 && (
          <ul className="note__list">
            {api.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function Note({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'ok'; title?: string; children?: ReactNode }) {
  return (
    <div className={`note note--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        {title && <p className="note__title">{title}</p>}
        {children && <div className="note__body">{children}</div>}
      </div>
    </div>
  )
}

export function Loading({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      {label}…
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      {children}
    </div>
  )
}

export function Page({ title, lead, actions, children, narrow }: { title: string; lead?: ReactNode; actions?: ReactNode; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={`page ${narrow ? 'page--narrow' : ''}`}>
      <header className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          {lead && <p className="page__lead">{lead}</p>}
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function PriceAlertNote({ alert, compact }: { alert: PriceAlert; compact?: boolean }) {
  const danger = alert.severity === 'danger'
  if (compact) {
    return (
      <p className={`pricetag pricetag--${alert.severity}`}>
        {danger ? <WarningOctagon size={16} weight="fill" aria-hidden /> : <Warning size={16} weight="fill" aria-hidden />}
        {alert.percentBelow}% bajo la mediana
      </p>
    )
  }
  return (
    <div className={`note note--${danger ? 'danger' : 'warning'}`} role={danger ? 'alert' : 'status'}>
      {danger ? <WarningOctagon size={22} weight="fill" aria-hidden /> : <Warning size={22} weight="fill" aria-hidden />}
      <p className="note__title note__title--plain">{alert.message}</p>
    </div>
  )
}

export function CriteriaList({ criteria }: { criteria: VerificationSummary['criteria'] }) {
  const byId = new Map(criteria.map((c) => [c.id, c]))
  return (
    <ul className="criteria">
      {CRITERIA.map((id: Criterion) => {
        const c = byId.get(id)
        const met = c?.met ?? false
        return (
          <li key={id} className={`criteria__item ${met ? 'is-met' : ''}`}>
            <span className="criteria__icon" aria-hidden>
              {met ? <Check size={16} weight="bold" /> : <X size={16} weight="bold" />}
            </span>
            <div>
              <p className="criteria__title">
                {CRITERION_LABEL[id].title}
                <span className="sr-only">{met ? ': revisado' : ': pendiente'}</span>
              </p>
              <p className="criteria__detail">{met ? CRITERION_LABEL[id].detail : 'Aún no lo revisamos.'}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
