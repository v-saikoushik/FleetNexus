import { CostIntelligenceService } from './cost-intelligence.service';
import { CostIntelligenceRepository } from './cost-intelligence.repository';
import { FinanceService } from '@/modules/finance/finance.service';
import { BusinessMemoryService } from './business-memory.service';

describe('CostIntelligenceService', () => {
  const finance = {
    resolvePeriod: jest.fn(),
    getSummary: jest.fn(),
    getTrips: jest.fn(),
    getVehicles: jest.fn(),
  };
  const repository = {
    findCompletedTripCosts: jest.fn(),
    findExpensesForPeriod: jest.fn(),
    findFuelForPeriod: jest.fn(),
  };
  const memory = { getOverview: jest.fn() };
  let service: CostIntelligenceService;
  const period = {
    period: 'MONTHLY',
    startDate: new Date('2026-05-01T00:00:00.000Z'),
    endDate: new Date('2026-05-31T23:59:59.999Z'),
  };
  const byCategory = {
    FUEL: 600,
    TOLL: 300,
    DRIVER_ALLOWANCE: 0,
    DRIVER_SALARY: 0,
    MAINTENANCE: 0,
    REPAIRS: 0,
    TYRES: 0,
    INSURANCE: 0,
    PERMIT_TAX: 0,
    LOADING: 0,
    UNLOADING: 0,
    COMMISSION: 0,
    PARKING: 0,
    FOOD_ALLOWANCE: 0,
    OTHER: 0,
  };
  const summary = {
    period: {
      period: 'MONTHLY',
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    },
    revenue: { total: 9_000, tripCount: 3, averagePerTrip: 3_000 },
    cashReceived: 4_500,
    outstanding: 4_500,
    expenses: { total: 900, count: 6, byCategory },
    profit: 8_100,
    profitMarginPct: 90,
    costPerKm: 4,
    profitPerKm: 27,
  };
  const tripReports = [1, 2, 3].map((index) => ({
    tripId: `trip-${index}`,
    tripNumber: `T-${index}`,
    startDate: `2026-05-0${index}T00:00:00.000Z`,
    vehicleId: 'vehicle-a',
    vehicleRegistrationNumber: 'KA01AA0001',
    customerId: 'customer-a',
    customerName: 'Acme',
    revenue: 3_000,
    costs: 300,
    profit: 2_700,
    marginPct: 90,
    costPerKm: 3,
    distanceKm: 100,
  }));
  const vehicleReports = [
    {
      vehicleId: 'vehicle-a',
      registrationNumber: 'KA01AA0001',
      tripCount: 3,
      revenue: 9_000,
      expenses: 900,
      profit: 8_100,
      profitMarginPct: 90,
      fuelCost: 600,
      costPerKm: 5.2,
      revenuePerKm: 30,
      profitPerKm: 27,
    },
  ];
  const tripCosts = [1, 2, 3].map((index) => ({
    id: `trip-${index}`,
    vehicleId: 'vehicle-a',
    customerId: 'customer-a',
    routeId: 'route-a',
    originName: 'Pune',
    destinationName: 'Mumbai',
    expenses: [{ id: `toll-${index}`, type: 'TOLL', amount: 100 }],
    fuelTransactions: [{ id: `fuel-${index}`, totalAmount: 200 }],
  }));
  const summaryFor = (startDate?: string) =>
    startDate?.startsWith('2026-03-31')
      ? {
          ...summary,
          revenue: { total: 6_000, tripCount: 3, averagePerTrip: 2_000 },
          expenses: {
            ...summary.expenses,
            total: 600,
            byCategory: { ...byCategory, FUEL: 400, TOLL: 200 },
          },
          profit: 5_400,
          profitMarginPct: 90,
          costPerKm: 3,
        }
      : summary;

  beforeEach(() => {
    jest.resetAllMocks();
    finance.resolvePeriod.mockImplementation((query: { startDate?: string; endDate?: string }) =>
      query.startDate && query.endDate
        ? {
            period: 'MONTHLY',
            startDate: new Date(query.startDate),
            endDate: new Date(query.endDate),
          }
        : period,
    );
    finance.getSummary.mockImplementation(
      (_organizationId: string, query: { startDate?: string }) =>
        Promise.resolve(summaryFor(query.startDate)),
    );
    finance.getTrips.mockResolvedValue({ period: summary.period, data: tripReports });
    finance.getVehicles.mockResolvedValue({ period: summary.period, data: vehicleReports });
    repository.findCompletedTripCosts.mockResolvedValue(tripCosts);
    repository.findExpensesForPeriod.mockResolvedValue([]);
    repository.findFuelForPeriod.mockResolvedValue([]);
    memory.getOverview.mockResolvedValue({
      sampleSize: 3,
      customers: [
        {
          id: 'customer-a',
          label: 'Acme',
          tripCount: 3,
          pricedTripCount: 3,
          totalRevenue: 9_000,
          totalCost: 900,
          totalProfit: 8_100,
          marginPct: 90,
          averageCostPerKm: 3,
        },
      ],
      routes: [
        {
          id: 'route-a',
          label: 'Pune → Mumbai',
          tripCount: 3,
          pricedTripCount: 3,
          totalRevenue: 9_000,
          totalCost: 900,
          totalProfit: 8_100,
          marginPct: 90,
          averageCostPerKm: 3,
        },
      ],
    });
    service = new CostIntelligenceService(
      finance as unknown as FinanceService,
      repository as unknown as CostIntelligenceRepository,
      memory as unknown as BusinessMemoryService,
    );
  });

  it('summarizes revenue separately from cash collections and compares periods', async () => {
    const result = await service.getSummary('org-a', { period: 'MONTHLY' });
    expect(result).toMatchObject({
      totalRevenue: 9_000,
      cashReceived: 4_500,
      totalExpenses: 900,
      totalProfit: 8_100,
      totalDistanceKm: 300,
      costPerKm: 4,
      averageProfitPerTrip: 2_700,
      averageRevenuePerTrip: 3_000,
      averageExpensePerTrip: 300,
      expenseToRevenuePct: 10,
      profitMarginPct: 90,
    });
    expect(result.comparison.sufficientData).toBe(true);
    expect(result.comparison.expenseCategories.TOLL).toMatchObject({
      current: 300,
      previous: 200,
      changePct: 50,
    });
    expect(finance.getSummary).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ period: 'MONTHLY' }),
    );
  });

  it('reports supported expense categories, category shares, counts, averages, and trends', async () => {
    repository.findCompletedTripCosts.mockResolvedValue(
      tripCosts.map((trip) => ({
        ...trip,
        expenses: [...trip.expenses, { id: `fuel-exp-${trip.id}`, type: 'FUEL', amount: 0 }],
      })),
    );
    const result = await service.getExpenses('org-a', { period: 'MONTHLY' });
    expect(result.data.find((item) => item.type === 'TOLL')).toMatchObject({
      totalAmount: 300,
      sharePct: 33.33,
      expenseCount: 3,
      averageExpense: 100,
      trendChangePct: 50,
      sampleSufficient: true,
    });
    expect(result.data.find((item) => item.type === 'FUEL')).toMatchObject({
      totalAmount: 600,
      expenseCount: 6,
    });
  });

  it('compares vehicle costs and emits rule flags only after the minimum trip threshold', async () => {
    const result = await service.getVehicles('org-a', { period: 'MONTHLY' });
    expect(result.data[0]).toMatchObject({
      registrationNumber: 'KA01AA0001',
      distanceKm: 300,
      costPerKm: 5.2,
      fuelCostPerKm: 2,
      sufficientData: true,
    });
    expect(result.data[0].flags.map((flag) => flag.code)).toContain('HIGH_COST_PER_KM');
    finance.getTrips.mockResolvedValue({ period: summary.period, data: tripReports.slice(0, 1) });
    finance.getVehicles.mockResolvedValue({
      period: summary.period,
      data: [{ ...vehicleReports[0], tripCount: 1 }],
    });
    const sparse = await service.getVehicles('org-a', { period: 'MONTHLY' });
    expect(sparse.data[0].sufficientData).toBe(false);
    expect(sparse.data[0].flags).toEqual([]);
  });

  it('returns customer/route profitability and deterministic insights', async () => {
    const customers = await service.getCustomers('org-a');
    const routes = await service.getRoutes('org-a');
    const insights = await service.getInsights('org-a', { period: 'MONTHLY' });
    expect(customers.data[0]).toMatchObject({
      customerName: 'Acme',
      revenue: 9_000,
      profit: 8_100,
      tripCount: 3,
      segment: 'HIGH_REVENUE_HIGH_PROFIT',
    });
    expect(routes.data[0]).toMatchObject({
      routeLabel: 'Pune → Mumbai',
      profit: 8_100,
      tollCost: 300,
      sufficientData: true,
    });
    expect(routes.data[0].flags.map((flag) => flag.code)).toContain('ROUTE_TOLL_COST_HIGH');
    expect(insights.data.every((flag) => flag.sampleSize >= 3)).toBe(true);
  });

  it('scopes finance, cost records, and business memory to the authenticated organization and reports insufficient data', async () => {
    finance.getTrips.mockResolvedValue({ period: summary.period, data: [] });
    finance.getVehicles.mockResolvedValue({ period: summary.period, data: [] });
    const result = await service.getSummary('org-a', { period: 'MONTHLY' });
    expect(result.sufficientData).toBe(false);
    expect(result.explanation).toContain('Insufficient historical data');
    expect(repository.findCompletedTripCosts).toHaveBeenCalledWith('org-a', expect.any(Object));
  });
});
