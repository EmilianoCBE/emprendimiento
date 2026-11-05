import { CheckCircle, X } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
}
type Notify = (message: string) => void

const ToastContext = createContext<Notify | null>(null)
const DURATION_MS = 5000

/** Confirma en pantalla lo que acaba de pasar (heurística 1). Un solo aviso a la vez: el nuevo reemplaza al anterior. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const notify = useCallback<Notify>((message) => setToast({ id: Date.now(), message }), [])

  useEffect(() => {
    if (!toast) return
    const handle = setTimeout(() => setToast(null), DURATION_MS)
    return () => clearTimeout(handle)
  }, [toast])

  const value = useMemo(() => notify, [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* La región existe siempre para que los lectores de pantalla anuncien el cambio. */}
      <div className="toastregion" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <CheckCircle size={22} weight="fill" aria-hidden />
            <p>{toast.message}</p>
            <button type="button" className="toast__close" aria-label="Cerrar aviso" onClick={() => setToast(null)}>
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Notify {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast fuera de ToastProvider')
  return value
}
