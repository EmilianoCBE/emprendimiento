import { ArrowLeft, Check, Warning, WarningOctagon, X } from '@phosphor-icons/react'
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { PriceAlert, Criterion, VerificationSummary } from '@aterriza/contracts'
import { CRITERIA, CRITERION_LABEL } from '@aterriza/contracts'
import { ApiError } from '../lib/api'

export function Button({ variant = 'primary', busy, children, className = '', ref, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} className={`btn btn--${variant} ${className}`} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>
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

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

/** `error` aparece junto al campo en cuanto se detecta, sin esperar al servidor (heurísticas 5 y 9). */
export function TextInput({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={error ? true : undefined} className="input" {...rest} />}</Field>
}

/** Contraseña que se puede ver antes de enviar (heurística 5). */
export function PasswordInput({ label, hint, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <div className="password">
          <input id={id} aria-describedby={d} className="input" type={visible ? 'text' : 'password'} {...rest} />
          <button type="button" className="password__toggle" aria-pressed={visible} aria-controls={id} onClick={() => setVisible((v) => !v)}>
            {visible ? 'Ocultar' : 'Mostrar'}
            <span className="sr-only"> contraseña</span>
          </button>
        </div>
      )}
    </Field>
  )
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

/**
 * Dice qué pasó y cómo salir (heurística 9): si la sesión terminó, lleva a entrar y regresar aquí;
 * si falló la conexión o el servidor, ofrece reintentar.
 */
export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const location = useLocation()
  if (!error) return null
  const api = error instanceof ApiError ? error : null
  const sessionEnded = api?.code === 'auth_required'
  const transient = !api || api.status === 0 || api.status >= 500 || api.status === 429
  const message = sessionEnded ? 'Tu sesión terminó. Vuelve a entrar para continuar.' : (api?.message ?? 'Algo falló. Vuelve a intentar.')
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
        {sessionEnded && (
          <p className="note__body">
            <Link to={`/entrar?volver=${encodeURIComponent(location.pathname + location.search)}`}>Entrar de nuevo</Link>
          </p>
        )}
        {!sessionEnded && transient && onRetry && (
          <div className="note__body">
            <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Acción que no se puede deshacer: el primer clic pide confirmación en el mismo lugar (heurísticas 3 y 5).
 * Escape o "No" regresan al estado inicial sin hacer nada.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  question = '¿Seguro?',
  onConfirm,
  busy,
  variant = 'danger',
  disabled,
}: {
  children: ReactNode
  confirmLabel: string
  question?: string
  onConfirm: () => void
  busy?: boolean
  variant?: 'danger' | 'secondary' | 'primary'
  disabled?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const yesRef = useRef<HTMLButtonElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const wasAsking = useRef(false)
  useEffect(() => {
    if (asking) yesRef.current?.focus()
    else if (wasAsking.current) startRef.current?.focus()
    wasAsking.current = asking
  }, [asking])
  if (!asking) {
    return (
      <Button ref={startRef} type="button" variant={variant} busy={busy} disabled={disabled} onClick={() => setAsking(true)}>
        {children}
      </Button>
    )
  }
  return (
    <span className="confirm" role="group" aria-label={question} onKeyDown={(e) => e.key === 'Escape' && setAsking(false)}>
      <span className="confirm__q">{question}</span>
      <Button
        ref={yesRef}
        type="button"
        variant={variant}
        busy={busy}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="quiet" onClick={() => setAsking(false)}>
        No
      </Button>
    </span>
  )
}

/** Regreso a la pantalla anterior conservando sus filtros cuando se conocen (heurísticas 3 y 6). */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const target = from && from.startsWith(to.split('?')[0]!) ? from : to
  return (
    <Link to={target} className="backlink">
      <ArrowLeft size={18} aria-hidden />
      {children}
    </Link>
  )
}

const BASE_TITLE = typeof document === 'undefined' ? 'Aterriza' : document.title

/** Título de la pestaña del navegador por pantalla (heurística 1). Al salir vuelve al título general, nunca al de otra pantalla. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · Aterriza`
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
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

/** Reserva el espacio del contenido para que la página no salte al terminar de cargar. */
export function Loading({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="skeleton" role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="skeleton__line" aria-hidden />
      <div className="skeleton__line" aria-hidden />
      <div className="skeleton__line" aria-hidden />
    </div>
  )
}

export function Empty({ title, children, as: Heading = 'h2' }: { title: string; children?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="empty">
      <Heading className="empty__title">{title}</Heading>
      {children}
    </div>
  )
}

export function Page({ title, lead, actions, children, narrow, back }: { title: string; lead?: ReactNode; actions?: ReactNode; children: ReactNode; narrow?: boolean; back?: ReactNode }) {
  usePageTitle(title)
  return (
    <div className={`page ${narrow ? 'page--narrow' : ''}`}>
      {back}
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

export function CriteriaList({ criteria, columns }: { criteria: VerificationSummary['criteria']; columns?: boolean }) {
  const byId = new Map(criteria.map((c) => [c.id, c]))
  return (
    <ul className={`criteria ${columns ? 'criteria--two' : ''}`}>
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
