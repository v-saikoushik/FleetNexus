import { ProfitabilityUtil, TripExpenses } from './profitability.util';

describe('ProfitabilityUtil', () => {
  const sampleExpenses: TripExpenses = {
    fuelCost: 1000,
    tollCost: 200,
    driverCost: 500,
    otherExpenses: 100,
    maintenanceAllocation: 200,
  };

  describe('calculateTotalCost', () => {
    it('should correctly sum all expenses', () => {
      const total = ProfitabilityUtil.calculateTotalCost(sampleExpenses);
      expect(total).toBe(2000);
    });
  });

  describe('calculateTripProfitability', () => {
    it('should calculate basic profit without distance and weight', () => {
      const result = ProfitabilityUtil.calculateTripProfitability(3000, sampleExpenses);

      expect(result.totalRevenue).toBe(3000);
      expect(result.totalCost).toBe(2000);
      expect(result.profit).toBe(1000);
      expect(result.profitPerKm).toBeNull();
      expect(result.profitPerTon).toBeNull();
    });

    it('should calculate per-km metrics when distance is provided', () => {
      const result = ProfitabilityUtil.calculateTripProfitability(3000, sampleExpenses, 100);

      expect(result.profit).toBe(1000);
      expect(result.profitPerKm).toBe(10);
      expect(result.revenuePerKm).toBe(30);
      expect(result.costPerKm).toBe(20);
    });

    it('should calculate per-ton metrics when weight is provided', () => {
      const result = ProfitabilityUtil.calculateTripProfitability(
        3000,
        sampleExpenses,
        undefined,
        10,
      );

      expect(result.profit).toBe(1000);
      expect(result.profitPerTon).toBe(100);
      expect(result.profitPerTonKm).toBeNull();
    });

    it('should calculate all metrics when distance and weight are provided', () => {
      const result = ProfitabilityUtil.calculateTripProfitability(3000, sampleExpenses, 100, 10);

      expect(result.profit).toBe(1000);
      expect(result.profitPerKm).toBe(10);
      expect(result.profitPerTon).toBe(100);
      expect(result.profitPerTonKm).toBe(1); // 1000 / (100 * 10)
    });
  });
});
