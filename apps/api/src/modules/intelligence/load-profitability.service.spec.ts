import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { LoadProfitabilityDto } from './dto/load-profitability.dto';
import { LoadProfitabilityService } from './load-profitability.service';

const evidence = {
  fuel: true,
  toll: true,
  driver: true,
  loadingUnloading: true,
  maintenance: true,
  other: true,
};
const makeTrip = (index: number, overrides: Record<string, unknown> = {}) => ({
  tripId: `trip-${index}`,
  tripNumber: `T-${index}`,
  date: `2025-01-${String((index % 25) + 1).padStart(2, '0')}T00:00:00.000Z`,
  routeLabel: 'A → B',
  commodityName: 'Grain',
  customerName: 'Acme',
  vehicleRegistrationNumber: 'AB-01',
  vehicleId: 'vehicle-1',
  vehicleType: 'TRUCK',
  vehicleCapacityTons: 10,
  revenue: 10_000 + index,
  revenueBasis: 'ACTUAL',
  totalCost: 3_000,
  profit: 7_000 + index,
  marginPct: 70,
  distanceKm: 100,
  costBreakdown: {
    fuelCost: 1_000,
    tollCost: 500,
    driverCost: 400,
    maintenanceAllocation: 300,
    otherExpenses: 800,
  },
  componentValues: {
    fuel: 1_000,
    toll: 500,
    driver: 400,
    loadingUnloading: 200,
    maintenance: 300,
    other: 600,
  },
  componentEvidence: evidence,
  fuelLitres: 10,
  fuelPurchaseAmount: 1_000,
  similarityReasons: ['Same route', 'Same commodity'],
  similarityScore: 2,
  ...overrides,
});

describe('LoadProfitabilityService', () => {
  const makeService = (
    trips: ReturnType<typeof makeTrip>[],
    routeDistance: number | null = 100,
  ) => {
    const memory = {
      getLoadComparables: jest.fn().mockResolvedValue({
        sampleSize: trips.length,
        customer: { id: 'customer', name: 'Acme' },
        route: { id: 'route', label: 'A → B', estimatedDistanceKm: routeDistance },
        commodity: { id: 'commodity', name: 'Grain' },
        vehicle: {
          id: 'vehicle-1',
          registrationNumber: 'AB-01',
          vehicleType: 'TRUCK',
          capacityTons: 10,
        },
        trips,
      }),
    };
    return { service: new LoadProfitabilityService(memory as never), memory };
  };
  const input = {
    routeId: 'route',
    commodityId: 'commodity',
    vehicleId: 'vehicle-1',
    offeredFreight: 12_000,
    expectedDistanceKm: 200,
    loadWeightTons: 5,
    proposedPickupDate: '2026-01-01',
  };

  it('uses organization-scoped comparable history to estimate revenue, fuel, total cost, profit, margin and per-km values', async () => {
    const { service, memory } = makeService(Array.from({ length: 15 }, (_, i) => makeTrip(i)));
    const result = await service.analyze('org-1', input);
    expect(memory.getLoadComparables).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        routeId: 'route',
        commodityId: 'commodity',
        vehicleId: 'vehicle-1',
      }),
    );
    expect(result.analysisStatus).toBe('SUPPORTED');
    expect(result.estimate.revenue).toMatchObject({ amount: 12_000, basis: 'PROVIDED' });
    expect(result.estimate.costs.components.fuel).toMatchObject({
      amount: 2_000,
      method: 'OBSERVED_VEHICLE_EFFICIENCY_AND_FUEL_PRICE',
    });
    expect(result.estimate.costs.total).toBe(4_000);
    expect(result.estimate.profit).toBe(8_000);
    expect(result.estimate.marginPct).toBeCloseTo(66.67, 1);
    expect(result.estimate.costPerKm).toBe(20);
    expect(result.estimate.profitPerKm).toBe(40);
  });

  it('classifies smaller samples as LIMITED and estimates omitted freight only from history', async () => {
    const { service } = makeService(Array.from({ length: 4 }, (_, i) => makeTrip(i)));
    const result = await service.analyze('org-1', {
      ...input,
      offeredFreight: undefined,
      vehicleId: undefined,
    });
    expect(result.analysisStatus).toBe('LIMITED');
    expect(result.estimate.revenue.basis).toBe('HISTORICAL_ESTIMATE');
    expect(result.dataQuality.some((item) => item.code === 'ESTIMATED_FREIGHT')).toBe(true);
    expect(result.historical.medianProfit).toBe(7001.5);
  });

  it('does not invent an estimate when there are no comparable trips or recorded costs', async () => {
    const { service } = makeService([]);
    const result = await service.analyze('org-1', input);
    expect(result.analysisStatus).toBe('INSUFFICIENT_DATA');
    expect(result.estimate.costs.total).toBeNull();
    expect(result.estimate.profit).toBeNull();
    expect(result.dataQuality.map((item) => item.code)).toContain('NO_COMPARABLE_TRIPS');
  });

  it('reports missing fuel, toll, and distance evidence without fabricating component values', async () => {
    const sparse = Array.from({ length: 3 }, (_, i) =>
      makeTrip(i, {
        componentEvidence: { ...evidence, fuel: false, toll: false },
        componentValues: {
          fuel: 0,
          toll: 0,
          driver: 400,
          loadingUnloading: 200,
          maintenance: 300,
          other: 600,
        },
        fuelLitres: 0,
        fuelPurchaseAmount: 0,
        distanceKm: null,
      }),
    );
    const { service } = makeService(sparse, null);
    const result = await service.analyze('org-1', {
      ...input,
      expectedDistanceKm: undefined,
      vehicleId: undefined,
    });
    expect(result.estimate.costs.components.fuel.amount).toBeNull();
    expect(result.estimate.costs.components.toll.amount).toBeNull();
    expect(result.estimate.costPerKm).toBeNull();
    expect(result.dataQuality.map((item) => item.code)).toEqual(
      expect.arrayContaining(['MISSING_FUEL_DATA', 'MISSING_TOLL_DATA', 'MISSING_DISTANCE']),
    );
  });

  it('rejects invalid date ordering and DTO freight/distance values', async () => {
    const { service } = makeService([]);
    await expect(
      service.analyze('org-1', {
        ...input,
        proposedPickupDate: '2026-02-02',
        proposedDeliveryDate: '2026-02-01',
      }),
    ).rejects.toThrow(BadRequestException);
    const dto = Object.assign(new LoadProfitabilityDto(), {
      ...input,
      offeredFreight: 0,
      expectedDistanceKm: -5,
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
