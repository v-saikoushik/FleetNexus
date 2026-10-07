import { BadRequestException } from '@nestjs/common';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const repository = {
    findCompletedTrips: jest.fn(),
    findExpensesForPeriod: jest.fn(),
    findFuelTransactionsForPeriod: jest.fn(),
    findReceivedPaymentsForPeriod: jest.fn(),
    findVehiclesForOrganization: jest.fn(),
    findCustomersForOrganization: jest.fn(),
  };
  let service: FinanceService;
  const trip = {
    id: 'trip-a',
    tripNumber: 'T-1',
    startDate: new Date('2026-06-02T10:00:00Z'),
    vehicleId: 'vehicle-a',
    customerId: 'customer-a',
    actualFreight: 900,
    estimatedFreight: 800,
    actualDistanceKm: 100,
    estimatedDistanceKm: 90,
    loadWeightTons: null,
    expenses: [{ id: 'expense-a', type: 'TOLL', amount: 100 }],
    fuelTransactions: [
      {
        id: 'fuel-a',
        date: new Date('2026-06-02'),
        vehicleId: 'vehicle-a',
        tripId: 'trip-a',
        litres: 10,
        totalAmount: 200,
      },
    ],
    payments: [
      { id: 'payment-a', amount: 300, status: 'PARTIAL' },
      { id: 'pending', amount: 500, status: 'PENDING' },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findCompletedTrips.mockResolvedValue([trip]);
    repository.findExpensesForPeriod.mockResolvedValue([
      {
        ...trip.expenses[0],
        date: new Date('2026-06-02'),
        description: 'toll',
        referenceNumber: null,
        tripId: 'trip-a',
        vehicleId: 'vehicle-a',
      },
    ]);
    repository.findFuelTransactionsForPeriod.mockResolvedValue(trip.fuelTransactions);
    repository.findReceivedPaymentsForPeriod.mockResolvedValue([
      { amount: 300, paymentDate: new Date('2026-06-03') },
    ]);
    repository.findVehiclesForOrganization.mockResolvedValue([
      { id: 'vehicle-a', registrationNumber: 'KA01AA0001' },
    ]);
    repository.findCustomersForOrganization.mockResolvedValue([{ id: 'customer-a', name: 'Acme' }]);
    service = new FinanceService(repository as unknown as FinanceRepository);
  });

  it('summarizes completed-trip revenue, recorded costs, profit, and paid collections', async () => {
    const result = await service.getSummary('org-a', { period: 'MONTHLY' });
    expect(result.revenue).toMatchObject({ total: 900, tripCount: 1, averagePerTrip: 900 });
    expect(result.cashReceived).toBe(300);
    expect(result.outstanding).toBe(600);
    expect(result.expenses.total).toBe(300);
    expect(result.expenses.byCategory.TOLL).toBe(100);
    expect(result.expenses.byCategory.FUEL).toBe(200);
    expect(result.profit).toBe(600);
    expect(result.profitMarginPct).toBeCloseTo(66.67, 2);
    expect(result.costPerKm).toBe(3);
    expect(result.profitPerKm).toBe(6);
    expect(result.financialFinalization).toMatchObject({
      finalized: { tripCount: 0, revenue: 0, recordedExpenses: 0, profit: 0 },
      unfinalized: { tripCount: 1, revenue: 900, recordedExpenses: 300, profit: 600 },
    });
    expect(repository.findCompletedTrips).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ period: 'MONTHLY' }),
    );
    expect(repository.findExpensesForPeriod).toHaveBeenCalledWith('org-a', expect.any(Object));
  });

  it('reports finalized amounts separately without changing existing finance totals', async () => {
    repository.findCompletedTrips.mockResolvedValue([{ ...trip, financialStatus: 'FINALIZED' }]);
    const result = await service.getSummary('org-a', { period: 'MONTHLY' });
    expect(result.revenue.total).toBe(900);
    expect(result.profit).toBe(600);
    expect(result.financialFinalization).toMatchObject({
      finalized: { tripCount: 1, revenue: 900, recordedExpenses: 300, profit: 600 },
      unfinalized: { tripCount: 0, revenue: 0, recordedExpenses: 0, profit: 0 },
    });
  });

  it('uses estimated freight when actual freight is unavailable', async () => {
    repository.findCompletedTrips.mockResolvedValue([{ ...trip, actualFreight: null }]);
    const result = await service.getSummary('org-a', { period: 'MONTHLY' });
    expect(result.revenue).toMatchObject({ total: 800, tripCount: 1, averagePerTrip: 800 });
    expect(result.outstanding).toBe(500);
    expect(result.profit).toBe(500);
  });

  it('returns trip and vehicle profitability based on the same cost utility', async () => {
    const trips = await service.getTrips('org-a', { period: 'MONTHLY' });
    const vehicles = await service.getVehicles('org-a', { period: 'MONTHLY' });
    expect(trips.data[0]).toMatchObject({
      tripNumber: 'T-1',
      revenue: 900,
      costs: 300,
      profit: 600,
      costPerKm: 3,
    });
    expect(vehicles.data[0]).toMatchObject({
      registrationNumber: 'KA01AA0001',
      revenue: 900,
      expenses: 300,
      profit: 600,
    });
  });

  it('builds cash flow from dated received payments and dated costs', async () => {
    const result = await service.getCashFlow('org-a', {
      period: 'MONTHLY',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
    expect(result.moneyIn).toBe(300);
    expect(result.moneyOut).toBe(300);
    expect(result.netCashFlow).toBe(0);
    expect(result.buckets.some((bucket) => bucket.moneyIn === 300)).toBe(true);
  });

  it('returns customer outstanding and expense views', async () => {
    const [outstanding, expenses] = await Promise.all([
      service.getOutstanding('org-a', { period: 'MONTHLY' }),
      service.getExpenses('org-a', { period: 'MONTHLY' }),
    ]);
    expect(outstanding.data[0]).toMatchObject({ customerName: 'Acme', outstanding: 600 });
    expect(expenses.recent[0]).toMatchObject({ amount: 100, tripNumber: 'T-1' });
    expect(expenses.highValue).toHaveLength(1);
  });

  it('does not invent insights or financial totals when there is no data', async () => {
    repository.findCompletedTrips.mockResolvedValue([]);
    repository.findExpensesForPeriod.mockResolvedValue([]);
    repository.findFuelTransactionsForPeriod.mockResolvedValue([]);
    repository.findVehiclesForOrganization.mockResolvedValue([]);
    const result = await service.getInsights('org-a', { period: 'MONTHLY' });
    expect(result.data).toEqual([]);
    expect((await service.getSummary('org-a', { period: 'MONTHLY' })).profit).toBeNull();
  });

  it('requires both dates and rejects reversed ranges', () => {
    expect(() => service.resolvePeriod({ startDate: '2026-06-01' })).toThrow(BadRequestException);
    expect(() => service.resolvePeriod({ startDate: '2026-06-03', endDate: '2026-06-01' })).toThrow(
      BadRequestException,
    );
  });
});
