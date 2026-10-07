import { NotFoundException } from '@nestjs/common';
import { RouteIntelligenceRepository } from './route-intelligence.repository';
import { RouteIntelligenceService } from './route-intelligence.service';

describe('RouteIntelligenceService', () => {
  const routeA = {
    id: 'route-a',
    estimatedDistance: 100,
    originLocationId: 'loc-a',
    destinationLocationId: 'loc-b',
  };
  const routeB = {
    ...routeA,
    id: 'route-b',
    originLocationId: 'loc-c',
    destinationLocationId: 'loc-d',
  };
  const makeTrip = (id: string, routeId = 'route-a', extra: Record<string, unknown> = {}) => ({
    id,
    routeId,
    vehicleId: 'vehicle-a',
    customerId: 'customer-a',
    commodityId: 'commodity-a',
    actualFreight: 1_000,
    estimatedFreight: null,
    actualDistanceKm: 100,
    estimatedDistanceKm: null,
    expenses: [
      { id: `${id}-toll`, type: 'TOLL', amount: 100 },
      { id: `${id}-driver`, type: 'DRIVER_ALLOWANCE', amount: 50 },
      { id: `${id}-loading`, type: 'LOADING', amount: 20 },
      { id: `${id}-commission`, type: 'COMMISSION', amount: 10 },
    ],
    fuelTransactions: [{ id: `${id}-fuel`, litres: 10, totalAmount: 100 }],
    payments: [{ id: `${id}-payment`, amount: 200, status: 'PAID' }],
    vehicle: { id: 'vehicle-a', registrationNumber: 'KA01AA0001' },
    customer: { id: 'customer-a', name: 'Acme' },
    commodity: { id: 'commodity-a', name: 'Flowers' },
    ...extra,
  });
  const tripRows = [makeTrip('trip-1'), makeTrip('trip-2'), makeTrip('trip-3')];
  const repository = {
    findRoute: jest.fn(),
    findRoutes: jest.fn(),
    findCompletedTrips: jest.fn(),
    findUnlinkedRouteExpenses: jest.fn(),
    findLocations: jest.fn(),
    findVehicles: jest.fn(),
    findCustomers: jest.fn(),
    findCommodities: jest.fn(),
  };
  let service: RouteIntelligenceService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findRoute.mockImplementation((_org: string, routeId: string) =>
      routeId === routeA.id ? routeA : routeId === routeB.id ? routeB : null,
    );
    repository.findRoutes.mockResolvedValue([routeA, routeB]);
    repository.findLocations.mockResolvedValue([
      { id: 'loc-a', name: 'Chennai', city: null, state: null },
      { id: 'loc-b', name: 'Vijayawada', city: null, state: null },
      { id: 'loc-c', name: 'Delhi', city: null, state: null },
      { id: 'loc-d', name: 'Jaipur', city: null, state: null },
    ]);
    repository.findVehicles.mockResolvedValue([
      { id: 'vehicle-a', registrationNumber: 'KA01AA0001' },
    ]);
    repository.findCustomers.mockResolvedValue([{ id: 'customer-a', name: 'Acme' }]);
    repository.findCommodities.mockResolvedValue([{ id: 'commodity-a', name: 'Flowers' }]);
    repository.findCompletedTrips.mockImplementation((_org: string, routeId?: string) => {
      if (routeId === 'route-a') return tripRows;
      if (routeId === 'route-b')
        return tripRows.map((trip, index) =>
          makeTrip(`b-${index}`, 'route-b', { actualFreight: 900 }),
        );
      return [
        ...tripRows,
        ...tripRows.map((trip, index) => makeTrip(`b-${index}`, 'route-b', { actualFreight: 900 })),
      ];
    });
    repository.findUnlinkedRouteExpenses.mockImplementation((_org: string, routeId?: string) =>
      routeId === 'route-a'
        ? [{ id: 'standalone-toll', type: 'TOLL', amount: 60, routeId: 'route-a' }]
        : [],
    );
    service = new RouteIntelligenceService(repository as unknown as RouteIntelligenceRepository);
  });

  it('calculates route revenue, cash, expenses, profit, distance, cost/km and profit/km', async () => {
    const result = await service.getAnalysis('org-a', 'route-a');
    expect(result).toMatchObject({
      route: { label: 'Chennai → Vijayawada', tripCount: 3 },
      sampleSize: 3,
      sufficientData: true,
    });
    expect(result.performance).toMatchObject({
      revenue: 3_000,
      cashReceived: 600,
      expenses: 900,
      profit: 2_100,
      averageRevenuePerTrip: 1_000,
      averageExpensePerTrip: 300,
      averageProfitPerTrip: 700,
      averageMarginPct: 70,
      totalDistanceKm: 300,
      costPerKm: 3,
      revenuePerKm: 10,
      profitPerKm: 7,
    });
  });

  it('breaks down supported expense categories and toll burden from linked and route-only expenses', async () => {
    const result = await service.getAnalysis('org-a', 'route-a');
    expect(result.expenses.find((item) => item.type === 'TOLL')).toMatchObject({
      total: 360,
      averagePerTrip: 120,
      sharePct: 40,
    });
    expect(result.expenses.find((item) => item.type === 'DRIVER_ALLOWANCE')).toMatchObject({
      total: 150,
      sharePct: 16.67,
    });
    expect(result.expenses.find((item) => item.type === 'LOADING')).toMatchObject({ total: 60 });
    expect(result.toll).toMatchObject({
      totalCost: 360,
      averagePerTrip: 120,
      costPerKm: 1.2,
      sharePct: 40,
    });
    expect(result.toll.otherRoutesAverageSharePct).toBeCloseTo(35.71, 2);
    expect(result.flags.map((flag) => flag.code)).toContain('HIGH_TOLL_BURDEN');
  });

  it('calculates route fuel cost, fuel efficiency and vehicle-by-route performance only from recorded data', async () => {
    const result = await service.getAnalysis('org-a', 'route-a');
    expect(result.fuel).toMatchObject({
      sufficientData: true,
      totalCost: 300,
      averageCostPerTrip: 100,
      totalLitres: 30,
      fuelCostPerKm: 1,
      kmPerLitre: 10,
      fleetFuelCostPerKm: 1,
    });
    expect(result.vehicles[0]).toMatchObject({
      label: 'KA01AA0001',
      tripCount: 3,
      revenue: 3_000,
      expenses: 840,
      profit: 2_160,
      marginPct: 72,
      costPerKm: 2.8,
      profitPerKm: 7.2,
      fuelCostPerKm: 1,
      fuelLitres: 30,
      kmPerLitre: 10,
      sufficientData: true,
    });
  });

  it('compares commodity and customer performance and produces traceable route insights', async () => {
    const result = await service.getAnalysis('org-a', 'route-a');
    expect(result.commodities[0]).toMatchObject({
      label: 'Flowers',
      tripCount: 3,
      averageFreight: 1_000,
      marginPct: 72,
    });
    expect(result.customers[0]).toMatchObject({
      label: 'Acme',
      tripCount: 3,
      revenue: 3_000,
      profit: 2_160,
    });
    expect(result.insights.some((item) => item.includes('across 3 completed trips'))).toBe(true);
  });

  it('compares routes on a selected historical metric and explains unavailable samples', async () => {
    const comparison = await service.compare('org-a', 'averageProfit');
    expect(comparison).toMatchObject({
      metric: 'averageProfit',
      sufficientData: true,
      routes: [
        { routeId: 'route-a', value: 700 },
        { routeId: 'route-b', value: 620 },
      ],
    });
  });

  it('withholds comparisons and efficiency for insufficient or missing route data', async () => {
    repository.findCompletedTrips.mockResolvedValue([
      makeTrip('one', 'route-a', { actualDistanceKm: null, actualFreight: null }),
    ]);
    const result = await service.getAnalysis('org-a', 'route-a');
    expect(result).toMatchObject({
      sufficientData: false,
      performance: {
        revenue: null,
        profit: null,
        totalDistanceKm: null,
        costPerKm: null,
        profitPerKm: null,
      },
      fuel: {
        sufficientData: false,
        explanation: 'Insufficient fuel data for this route.',
        kmPerLitre: null,
      },
    });
    expect(result.flags.map((flag) => flag.code)).toContain('INSUFFICIENT_ROUTE_DATA');
    expect(result.vehicles[0].sufficientData).toBe(false);
  });

  it('enforces route organization ownership before returning any report', async () => {
    repository.findRoute.mockResolvedValue(null);
    await expect(service.getAnalysis('org-other', 'route-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
