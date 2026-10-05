export interface TripExpenses {
  fuelCost: number;
  tollCost: number;
  driverCost: number;
  otherExpenses: number;
  maintenanceAllocation: number;
}

export interface ProfitabilityMetrics {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitPerKm: number | null;
  revenuePerKm: number | null;
  costPerKm: number | null;
  profitPerTon: number | null;
  profitPerTonKm: number | null;
  marginPct: number | null;
}

export type ProfitabilityBasis = 'ESTIMATED' | 'ACTUAL';

export interface TripProfitabilityResult extends ProfitabilityMetrics {
  basis: ProfitabilityBasis;
}

export type ExpenseAmountRecord = {
  type: string;
  amount: number | { toNumber?: () => number } | string;
};

export type FuelAmountRecord = {
  litres?: number | { toNumber?: () => number } | string | null;
  totalAmount: number | { toNumber?: () => number } | string;
};

const DRIVER_EXPENSE_TYPES = new Set(['DRIVER_ALLOWANCE', 'DRIVER_SALARY', 'FOOD_ALLOWANCE']);

const MAINTENANCE_EXPENSE_TYPES = new Set(['MAINTENANCE', 'REPAIRS', 'TYRES']);

export class ProfitabilityUtil {
  static toNumber(value: number | { toNumber?: () => number } | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    if (typeof value.toNumber === 'function') return value.toNumber();
    return Number(value) || 0;
  }

  /**
   * Maps persisted expense + fuel rows into the TripExpenses shape used by calculations.
   * FuelTransaction amounts are included in fuelCost (in addition to ExpenseType.FUEL).
   */
  static buildExpensesFromRecords(
    expenses: ExpenseAmountRecord[] = [],
    fuelTransactions: FuelAmountRecord[] = [],
  ): TripExpenses {
    const result: TripExpenses = {
      fuelCost: 0,
      tollCost: 0,
      driverCost: 0,
      otherExpenses: 0,
      maintenanceAllocation: 0,
    };

    for (const expense of expenses) {
      const amount = this.toNumber(expense.amount);
      switch (expense.type) {
        case 'FUEL':
          result.fuelCost += amount;
          break;
        case 'TOLL':
          result.tollCost += amount;
          break;
        default:
          if (DRIVER_EXPENSE_TYPES.has(expense.type)) {
            result.driverCost += amount;
          } else if (MAINTENANCE_EXPENSE_TYPES.has(expense.type)) {
            result.maintenanceAllocation += amount;
          } else {
            result.otherExpenses += amount;
          }
      }
    }

    for (const fuel of fuelTransactions) {
      result.fuelCost += this.toNumber(fuel.totalAmount);
    }

    return result;
  }

  static calculateTotalCost(expenses: TripExpenses): number {
    return (
      expenses.fuelCost +
      expenses.tollCost +
      expenses.driverCost +
      expenses.otherExpenses +
      expenses.maintenanceAllocation
    );
  }

  /**
   * Calculates comprehensive profitability metrics for a trip.
   */
  static calculateTripProfitability(
    revenue: number,
    expenses: TripExpenses,
    distance?: number,
    weight?: number,
  ): ProfitabilityMetrics {
    const totalCost = this.calculateTotalCost(expenses);
    const profit = revenue - totalCost;

    const hasDistance = distance !== undefined && distance > 0;
    const hasWeight = weight !== undefined && weight > 0;

    return {
      totalRevenue: revenue,
      totalCost,
      profit,
      profitPerKm: hasDistance ? profit / distance : null,
      revenuePerKm: hasDistance ? revenue / distance : null,
      costPerKm: hasDistance ? totalCost / distance : null,
      profitPerTon: hasWeight ? profit / weight : null,
      profitPerTonKm: hasDistance && hasWeight ? profit / (distance * weight) : null,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
    };
  }

  /**
   * Returns ESTIMATED and/or ACTUAL profitability. Does not invent missing cost data —
   * costs come only from recorded expenses/fuel. Revenue uses estimatedFreight vs actualFreight.
   */
  static calculateEstimatedAndActual(input: {
    estimatedFreight?: number | null;
    actualFreight?: number | null;
    expenses: ExpenseAmountRecord[];
    fuelTransactions: FuelAmountRecord[];
    estimatedDistanceKm?: number | null;
    actualDistanceKm?: number | null;
    loadWeightTons?: number | null;
  }): { estimated: TripProfitabilityResult | null; actual: TripProfitabilityResult | null } {
    const tripExpenses = this.buildExpensesFromRecords(input.expenses, input.fuelTransactions);
    const weight = input.loadWeightTons != null ? this.toNumber(input.loadWeightTons) : undefined;

    const estimated =
      input.estimatedFreight != null
        ? {
            basis: 'ESTIMATED' as const,
            ...this.calculateTripProfitability(
              this.toNumber(input.estimatedFreight),
              tripExpenses,
              input.estimatedDistanceKm != null
                ? this.toNumber(input.estimatedDistanceKm)
                : undefined,
              weight,
            ),
          }
        : null;

    const actual =
      input.actualFreight != null
        ? {
            basis: 'ACTUAL' as const,
            ...this.calculateTripProfitability(
              this.toNumber(input.actualFreight),
              tripExpenses,
              input.actualDistanceKm != null
                ? this.toNumber(input.actualDistanceKm)
                : input.estimatedDistanceKm != null
                  ? this.toNumber(input.estimatedDistanceKm)
                  : undefined,
              weight,
            ),
          }
        : null;

    return { estimated, actual };
  }
}
