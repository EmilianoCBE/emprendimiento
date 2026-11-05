import type { BudgetEstimate, BudgetInput, ChecklistItem, Guide } from '@aterriza/contracts'
import type { Queryable } from '../../platform/db.ts'
import { DomainError, notFound } from '../../platform/kernel.ts'
import { type Assumptions, type CostEstimator, defaultEstimator } from './domain.ts'

interface GuideRow {
  id: string
  slug: string
  category: string
  title: string
  summary: string
  body: string
  reviewed_on: string
}
const toGuide = (g: GuideRow): Guide => ({
  id: g.id,
  slug: g.slug,
  category: g.category,
  title: g.title,
  summary: g.summary,
  body: g.body,
  reviewedOn: g.reviewed_on,
})
const GUIDE_COLUMNS = 'id, slug, category, title, summary, body, reviewed_on::text AS reviewed_on'

export interface ListingCostFacts {
  monthlyRentMxn: number
  depositMonths: number
  utilitiesIncluded: boolean
  minutesTransit: number
  airConditioning: boolean
}

export class PlanningService {
  constructor(
    private readonly db: Queryable,
    private readonly estimator: CostEstimator = defaultEstimator(),
  ) {}

  private async assumptions(): Promise<Assumptions> {
    const rows = await this.db.query<{ key: string; amount_mxn: number }>('SELECT key, amount_mxn FROM cost_assumptions')
    return Object.fromEntries(rows.map((r) => [r.key, r.amount_mxn]))
  }

  async estimate(input: BudgetInput): Promise<BudgetEstimate> {
    let facts: Partial<ListingCostFacts> = {}
    if (input.listingId) {
      // Solo viviendas públicas: la calculadora no debe filtrar datos de borradores.
      const [row] = await this.db.query<{ monthly_rent_mxn: number; deposit_months: number; utilities_included: boolean; minutes_transit: number }>(
        `SELECT monthly_rent_mxn, deposit_months, utilities_included, minutes_transit FROM listings WHERE id = $1 AND status = 'active'`,
        [input.listingId],
      )
      if (!row) throw notFound('La vivienda')
      facts = {
        monthlyRentMxn: row.monthly_rent_mxn,
        depositMonths: row.deposit_months,
        utilitiesIncluded: row.utilities_included,
        minutesTransit: row.minutes_transit,
      }
    } else if (input.monthlyRent === undefined) {
      throw new DomainError('bad_request', 'rent_required', 'Elige una vivienda o escribe una renta.')
    }
    return this.estimator.estimate({
      rent: facts.monthlyRentMxn ?? input.monthlyRent ?? 0,
      depositMonths: facts.depositMonths ?? input.depositMonths ?? 1,
      utilitiesIncluded: facts.utilitiesIncluded ?? input.utilitiesIncluded ?? false,
      minutesTransit: facts.minutesTransit ?? input.minutesTransit ?? 20,
      arrivalMonth: input.arrivalMonth,
      usesAc: input.usesAc,
      international: input.international,
      assumptions: await this.assumptions(),
    })
  }

  /** Estimación "peor razonable" para fichas: llega en agosto, primer semestre típico de calor. */
  async estimateForListing(f: ListingCostFacts): Promise<BudgetEstimate> {
    return this.estimateWith(f, await this.assumptions())
  }

  estimateWith(f: ListingCostFacts, assumptions: Assumptions): BudgetEstimate {
    return this.estimator.estimate({
      rent: f.monthlyRentMxn,
      depositMonths: f.depositMonths,
      utilitiesIncluded: f.utilitiesIncluded,
      minutesTransit: f.minutesTransit,
      arrivalMonth: 8,
      usesAc: f.airConditioning,
      international: true,
      assumptions,
    })
  }

  loadAssumptions(): Promise<Assumptions> {
    return this.assumptions()
  }

  async listGuides(): Promise<Guide[]> {
    return (await this.db.query<GuideRow>(`SELECT ${GUIDE_COLUMNS} FROM guides ORDER BY position, title`)).map(toGuide)
  }

  async getGuide(slug: string): Promise<Guide> {
    const [g] = await this.db.query<GuideRow>(`SELECT ${GUIDE_COLUMNS} FROM guides WHERE slug = $1`, [slug])
    if (!g) throw notFound('La guía')
    return toGuide(g)
  }

  async getChecklist(userId: string): Promise<ChecklistItem[]> {
    const rows = await this.db.query<{ id: string; phase: 'before' | 'week1'; title: string; hint: string; done: boolean }>(
      `SELECT t.id, t.phase, t.title, t.hint, (p.task_id IS NOT NULL) AS done
       FROM checklist_tasks t LEFT JOIN checklist_progress p ON p.task_id = t.id AND p.user_id = $1
       ORDER BY t.position`,
      [userId],
    )
    return rows
  }

  async setChecklist(userId: string, taskId: string, done: boolean): Promise<void> {
    const [task] = await this.db.query('SELECT 1 FROM checklist_tasks WHERE id = $1', [taskId])
    if (!task) throw notFound('La tarea')
    if (done) {
      await this.db.query('INSERT INTO checklist_progress (user_id, task_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, taskId])
    } else {
      await this.db.query('DELETE FROM checklist_progress WHERE user_id = $1 AND task_id = $2', [userId, taskId])
    }
  }
}
