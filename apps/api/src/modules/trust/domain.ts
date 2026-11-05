/** Reglas puras de confianza: puntaje, política de reportes y señales de estafa. */

/**
 * Promedio con un valor previo que pesa como `priorWeight` reseñas, para que una sola
 * reseña de 5 no supere a muchas reseñas buenas (SUP-07).
 */
export function trustScore(ratings: readonly number[], priorMean = 3.5, priorWeight = 3): number | null {
  if (ratings.length === 0) return null
  const sum = ratings.reduce((a, b) => a + b, 0)
  return Math.round(((sum + priorMean * priorWeight) / (ratings.length + priorWeight)) * 10) / 10
}

/** Strategy: el umbral es un supuesto por validar (SUP-02). */
export interface FlagPolicy {
  shouldFlag(distinctReporters: number): boolean
}
export class DistinctReportersPolicy implements FlagPolicy {
  constructor(private readonly threshold = 3) {}
  shouldFlag(distinctReporters: number): boolean {
    return distinctReporters >= this.threshold
  }
}

export function stayLabel(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${fmt.format(new Date(`${start}T00:00:00Z`))} a ${fmt.format(new Date(`${end}T00:00:00Z`))}`
}

// ---------- Señales de estafa ----------
export interface ScamDetector {
  id: string
  label: string
  matches(normalized: string, raw: string): boolean
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Agregar una señal es añadir un elemento a esta lista. */
export const SCAM_DETECTORS: readonly ScamDetector[] = [
  {
    id: 'bank_details',
    label: 'Comparte datos bancarios',
    matches: (n, raw) => /\bclabe\b|\bcuenta (bancaria|de banco)\b|\biban\b/.test(n) || /\d{18}/.test(raw.replace(/[\s-]/g, '')),
  },
  {
    id: 'advance_payment',
    label: 'Pide un pago por adelantado',
    matches: (n) =>
      /\b(transfiere|transferencia|transferir|deposita|depositame|deposito hoy|paga(me)? (hoy|ya|antes)|anticipo|apartar? con|para apartar|western union|deposito en oxxo|pago en oxxo|paypal|zelle)\b/.test(n),
  },
  {
    id: 'off_platform',
    label: 'Quiere llevar la conversación a otra app',
    matches: (n, raw) =>
      /\b(whatsapp|whats|wa\.me|telegram|signal|escribeme a|hablame al|marcame)\b/.test(n) || /(?:\+?\d[\s-]?){10,13}/.test(raw),
  },
  {
    id: 'urgency',
    label: 'Te presiona para decidir de inmediato',
    matches: (n) => /\b(hay mas interesados|ultima oportunidad|hoy mismo o|se va hoy|solo por hoy|decide ya)\b/.test(n),
  },
  {
    id: 'cash_no_receipt',
    label: 'Pide efectivo sin recibo',
    matches: (n) => /\bsin recibo\b|\bsolo efectivo\b|\bno (doy|damos|hay) recibos?\b/.test(n),
  },
]

export const RISK_LABEL: Record<string, string> = Object.fromEntries(SCAM_DETECTORS.map((d) => [d.id, d.label]))

export function detectScamSignals(body: string, detectors: readonly ScamDetector[] = SCAM_DETECTORS): string[] {
  const n = normalize(body)
  return detectors.filter((d) => d.matches(n, body)).map((d) => d.id)
}
