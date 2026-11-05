/** Calculadora del primer mes. Cada rubro es un componente; agregar uno no toca al estimador. */
import type { BudgetEstimate, CostLine } from '@aterriza/contracts'

export type Assumptions = Record<string, number>

export interface CostContext {
  rent: number
  depositMonths: number
  utilitiesIncluded: boolean
  minutesTransit: number
  arrivalMonth: number
  usesAc: boolean
  international: boolean
  assumptions: Assumptions
}

export const isHotSeason = (month: number) => month >= 5 && month <= 9

const need = (a: Assumptions, key: string) => a[key] ?? 0

export interface CostComponent {
  build(ctx: CostContext): CostLine | null
}

const rent: CostComponent = {
  build: (c) => ({
    id: 'rent',
    label: 'Renta',
    amountMxn: c.rent,
    source: 'listing',
    firstMonthOnly: false,
  }),
}

const deposit: CostComponent = {
  build: (c) =>
    c.depositMonths > 0
      ? {
          id: 'deposit',
          label: 'Depósito en garantía',
          amountMxn: Math.round(c.rent * c.depositMonths),
          note: 'Pídelo por contrato y con recibo; debe regresar al salir si no hay daños.',
          source: 'listing',
          firstMonthOnly: true,
        }
      : null,
}

const electricity: CostComponent = {
  build: (c) => {
    if (c.utilitiesIncluded) return null
    const heavy = isHotSeason(c.arrivalMonth) && c.usesAc
    return {
      id: 'electricity',
      label: 'Luz',
      amountMxn: need(c.assumptions, heavy ? 'electricity_hot_ac' : 'electricity_mild'),
      note: heavy ? 'Con aire acondicionado en temporada de calor.' : 'Consumo moderado, sin uso intenso de aire.',
      source: 'estimate',
      firstMonthOnly: false,
    }
  },
}

const internet: CostComponent = {
  build: (c) =>
    c.utilitiesIncluded
      ? null
      : { id: 'internet', label: 'Internet', amountMxn: need(c.assumptions, 'internet'), source: 'estimate', firstMonthOnly: false },
}

const transport: CostComponent = {
  build: (c) => {
    const near = c.minutesTransit <= 15
    return {
      id: 'transport',
      label: 'Transporte',
      amountMxn: need(c.assumptions, near ? 'transport_near' : 'transport_far'),
      note: near ? 'Cerca del campus; algunos traslados a otras zonas.' : 'A más de 15 minutos: traslado diario.',
      source: 'estimate',
      firstMonthOnly: false,
    }
  },
}

const food: CostComponent = {
  build: (c) => ({ id: 'food', label: 'Comida', amountMxn: need(c.assumptions, 'food'), source: 'estimate', firstMonthOnly: false }),
}

const phone: CostComponent = {
  build: (c) => ({ id: 'phone', label: 'Línea de celular', amountMxn: need(c.assumptions, 'phone'), source: 'estimate', firstMonthOnly: false }),
}

const bankFees: CostComponent = {
  build: (c) =>
    c.international
      ? {
          id: 'bank_fees',
          label: 'Comisiones bancarias',
          amountMxn: need(c.assumptions, 'bank_fees'),
          note: 'Retiros y pagos con tarjeta extranjera; varía según tu banco.',
          source: 'estimate',
          firstMonthOnly: false,
        }
      : null,
}

const setup: CostComponent = {
  build: (c) => ({
    id: 'setup',
    label: 'Instalación inicial',
    amountMxn: need(c.assumptions, 'setup'),
    note: 'Ropa de cama, utensilios y compras básicas de la primera semana.',
    source: 'estimate',
    firstMonthOnly: true,
  }),
}

/** Composite: trata a todos los rubros como uno solo. */
export class CostEstimator {
  constructor(private readonly components: readonly CostComponent[]) {}

  estimate(ctx: CostContext): BudgetEstimate {
    const lines = this.components.map((c) => c.build(ctx)).filter((l): l is CostLine => l !== null)
    const sum = (filter: (l: CostLine) => boolean) => lines.filter(filter).reduce((acc, l) => acc + l.amountMxn, 0)
    return {
      lines,
      firstMonthTotalMxn: sum(() => true),
      typicalMonthTotalMxn: sum((l) => !l.firstMonthOnly),
      estimatedShareMxn: sum((l) => l.source === 'estimate'),
      alerts: hiddenCostAlerts(ctx),
    }
  }
}

export const defaultEstimator = () => new CostEstimator([rent, deposit, electricity, internet, transport, food, phone, bankFees, setup])

/** Gastos que las entrevistas señalaron como sorpresa. */
export function hiddenCostAlerts(c: CostContext): BudgetEstimate['alerts'] {
  const alerts: BudgetEstimate['alerts'] = []
  if (!c.utilitiesIncluded && isHotSeason(c.arrivalMonth) && c.usesAc) {
    alerts.push({
      id: 'ac',
      title: 'El recibo de luz puede subir mucho',
      detail: 'Fue el gasto inesperado más mencionado en las entrevistas. Pregunta cuánto se pagó en meses de calor y si el recibo se divide.',
    })
  }
  if (c.utilitiesIncluded) {
    alerts.push({
      id: 'cap',
      title: 'Confirma qué significa "servicios incluidos"',
      detail: 'Algunos contratos ponen un tope de luz. Pide por escrito si hay límite y quién paga el excedente.',
    })
  }
  if (c.minutesTransit > 15) {
    alerts.push({
      id: 'transport',
      title: 'Monterrey está pensada para el coche',
      detail: 'Prueba tu ruta en horas pico antes de decidir: las apps de transporte privado pueden subir este gasto.',
    })
  }
  if (c.international) {
    alerts.push({
      id: 'fees',
      title: 'Tu banco puede cobrar por cada retiro',
      detail: 'Pregunta por comisiones y tipo de cambio antes de viajar, y lleva más de una forma de pago.',
    })
  }
  return alerts
}
