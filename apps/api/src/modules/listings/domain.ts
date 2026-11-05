/** Reglas puras de vivienda: sello, alerta de precio y búsqueda. Sin dependencias. */
import { CRITERIA, type Criterion, type PriceAlert, type VerificationLevel } from '@aterriza/contracts'

export const PARTIAL_THRESHOLD = 2

export function verificationLevel(metCount: number, total: number = CRITERIA.length): VerificationLevel {
  if (metCount >= total) return 'verified'
  if (metCount >= PARTIAL_THRESHOLD) return 'partial'
  return 'unverified'
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2)
}

export interface Benchmark {
  median: number
  scope: 'zone' | 'city'
}

export const MIN_ZONE_SAMPLE = 3

/** Un cuarto compartido no se compara con un departamento: sería una falsa alarma. */
export type PriceCategory = 'shared' | 'private'
export const priceCategory = (kind: string): PriceCategory => (kind === 'room' || kind === 'residence' ? 'shared' : 'private')

/** Mediana de la zona si la muestra alcanza; si no, de toda la ciudad. */
export function benchmarkFor(zoneRents: readonly number[], cityRents: readonly number[]): Benchmark {
  return zoneRents.length >= MIN_ZONE_SAMPLE
    ? { median: median(zoneRents), scope: 'zone' }
    : { median: median(cityRents), scope: 'city' }
}

/** Strategy: los umbrales son un supuesto por validar (SUP-01). */
export interface PriceAlertPolicy {
  evaluate(rent: number, benchmark: Benchmark): PriceAlert | null
}

export class BelowMedianPolicy implements PriceAlertPolicy {
  constructor(
    private readonly warningBelow = 0.2,
    private readonly dangerBelow = 0.35,
  ) {}

  evaluate(rent: number, b: Benchmark): PriceAlert | null {
    if (b.median <= 0) return null
    // (mediana - renta) / mediana evita el error de redondeo de 1 - renta / mediana en los umbrales exactos.
    const below = (b.median - rent) / b.median
    if (below < this.warningBelow) return null
    const percentBelow = Math.round(below * 100)
    const where = b.scope === 'zone' ? 'de viviendas parecidas en la zona' : 'de viviendas parecidas en la ciudad'
    const danger = below >= this.dangerBelow
    return {
      severity: danger ? 'danger' : 'warning',
      percentBelow,
      medianMxn: b.median,
      scope: b.scope,
      message: danger
        ? `Renta ${percentBelow}% más baja que la mediana ${where}. Es una señal frecuente de anuncio falso: no transfieras dinero sin ver el lugar y firmar contrato.`
        : `Renta ${percentBelow}% más baja que la mediana ${where}. Pregunta por qué antes de decidir.`,
    }
  }
}

/** Builder: arma un WHERE parametrizado. Nunca concatena valores del usuario. */
export class SqlWhereBuilder {
  private readonly clauses: string[] = []
  readonly params: unknown[] = []

  where(clause: string): this {
    this.clauses.push(clause)
    return this
  }
  /** `$?` en la cláusula se sustituye por el parámetro. Sin valor, no agrega nada. */
  whereIf(value: unknown, clause: string): this {
    if (value === undefined || value === null || value === '' || value === false) return this
    this.params.push(value)
    this.clauses.push(clause.replaceAll('$?', `$${this.params.length}`))
    return this
  }
  toSql(): string {
    return this.clauses.length > 0 ? `WHERE ${this.clauses.join(' AND ')}` : ''
  }
}

export function criteriaFromRows(rows: readonly { criterion: string; met: boolean; checked_at: Date | null }[]) {
  const byId = new Map(rows.map((r) => [r.criterion, r]))
  const criteria = CRITERIA.map((id: Criterion) => {
    const row = byId.get(id)
    return { id, met: row?.met ?? false, checkedAt: row?.checked_at ? row.checked_at.toISOString() : null }
  })
  const metCount = criteria.filter((c) => c.met).length
  return { criteria, metCount, level: verificationLevel(metCount) }
}

/** Escapa los comodines de ILIKE para que el texto buscado se trate literalmente. */
export const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Desplaza las coordenadas para no revelar la ubicación exacta (hasta ~300 m). */
export function approximateNear(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.006
  const dLng = (((h >> 10) % 1000) / 1000 - 0.5) * 0.006
  return { lat: lat + dLat, lng: lng + dLng }
}
