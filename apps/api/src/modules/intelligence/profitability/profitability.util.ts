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
}

export class ProfitabilityUtil {
  /**
   * Calculates the total cost of a trip based on various expenses.
   */
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
   *
   * @param revenue Total freight amount / revenue
   * @param expenses Trip expenses
   * @param distance Actual or estimated distance in km (optional)
   * @param weight Actual load weight in tons (optional)
   * @returns Calculated metrics including per-km and per-ton derivations
   */
  static calculateTripProfitability(
    revenue: number,
    expenses: TripExpenses,
    distance?: number,
    weight?: number,
  ): ProfitabilityMetrics {
    const totalCost = this.calculateTotalCost(expenses);
    const profit = revenue - totalCost;

    const hasDistance = distance && distance > 0;
    const hasWeight = weight && weight > 0;

    return {
      totalRevenue: revenue,
      totalCost,
      profit,
      profitPerKm: hasDistance ? profit / distance : null,
      revenuePerKm: hasDistance ? revenue / distance : null,
      costPerKm: hasDistance ? totalCost / distance : null,
      profitPerTon: hasWeight ? profit / weight : null,
      profitPerTonKm: hasDistance && hasWeight ? profit / (distance * weight) : null,
    };
  }
}
