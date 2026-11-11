import { useEffect } from 'react'

/**
 * Hace aparecer, una sola vez, cada elemento `.reveal` cuando entra en pantalla.
 * El estado oculto solo existe en CSS si la persona no pidió reducir el movimiento,
 * y si el navegador no puede observar, todo se muestra de inmediato.
 */
export function useReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!('IntersectionObserver' in window)) {
      for (const el of items) el.classList.add('is-in')
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    )
    for (const el of items) observer.observe(el)
    return () => observer.disconnect()
  }, [])
}
