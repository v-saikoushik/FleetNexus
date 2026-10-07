import { NotFoundException } from '@nestjs/common';
import { SeasonalityRepository } from './seasonality.repository';
import { SeasonalityService } from './seasonality.service';

const routeId = '84d2e707-64bb-4b7b-b25c-9e872bef68bb';
const commodityId = 'b4969fbd-3452-413a-84b0-20c064e5016b';
const customerId = '22c64b18-34fc-469f-8cc4-8c729e8ecb96';

describe('SeasonalityService', () => {
  const makeTrip = (year: number, month: number, index: number) => {
    const costs = month === 2 ? 400 : month === 1 ? 900 : 950;
    return {
      id: `trip-${year}-${month}-${index}`,
      startDate: new Date(Date.UTC(year, month - 1, index + 1)),
      routeId,
      commodityId,
      customerId,
      originName: 'Chennai',
      destinationName: 'Vijayawada',
      actualFreight: 1_000,
      estimatedFreight: null,
      actualDistanceKm: 100,
      estimatedDistanceKm: null,
      expenses: [{ id: `cost-${year}-${month}-${index}`, type: 'TOLL', amount: costs }],
      fuelTransactions: [],
      payments: [{ id: `payment-${year}-${month}-${index}`, amount: 200, status: 'PAID' }],
    };
  };
  const history = [
    ...[1, 1, 1, 2, 2, 3].map((month, index) => makeTrip(2024, month, index)),
    ...[1, 1, 1, 2, 2, 3].map((month, index) => makeTrip(2025, month, index)),
  ];
  const repository = {
    findCompletedTrips: jest.fn(),
    findCommodities: jest.fn(),
    findCustomers: jest.fn(),
    findRoutes: jest.fn(),
    findLocations: jest.fn(),
    findUnlinkedExpenses: jest.fn(),
    findUnlinkedFuelTransactions: jest.fn(),
    findCommodity: jest.fn(),
    findCustomer: jest.fn(),
    findRoute: jest.fn(),
  };
  let service: SeasonalityService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findCompletedTrips.mockResolvedValue(history);
    repository.findCommodities.mockResolvedValue([{ id: commodityId, name: 'Flowers' }]);
    repository.findCustomers.mockResolvedValue([{ id: customerId, name: 'Acme' }]);
    repository.findRoutes.mockResolvedValue([
      { id: routeId, originLocationId: 'origin', destinationLocationId: 'destination' },
    ]);
    repository.findLocations.mockResolvedValue([
      { id: 'origin', name: 'Chennai', city: null, state: null },
      { id: 'destination', name: 'Vijayawada', city: null, state: null },
    ]);
    repository.findUnlinkedExpenses.mockResolvedValue([]);
    repository.findUnlinkedFuelTransactions.mockResolvedValue([]);
    repository.findCommodity.mockResolvedValue({ id: commodityId, name: 'Flowers' });
    repository.findCustomer.mockResolvedValue({ id: customerId, name: 'Acme' });
    repository.findRoute.mockResolvedValue({
      id: routeId,
      originLocationId: 'origin',
      destinationLocationId: 'destination',
    });
    service = new SeasonalityService(repository as unknown as SeasonalityRepository);
  });

  it('aggregates monthly fleet activity from completed trip history', async () => {
    const result = await service.getOverview('org-a');
    expect(result).toMatchObject({ sampleSize: 12, sufficientData: true });
    expect(result.monthlyActivity).toHaveLength(6);
    expect(
      result.monthlyActivity.find((item) => item.year === 2024 && item.month === 1),
    ).toMatchObject({
      tripCount: 3,
      revenue: 3_000,
      expenses: 2_700,
      profit: 300,
      averageFreight: 1_000,
      averageProfitPerTrip: 100,
      averageMarginPct: 10,
      averageCostPerKm: 9,
      distanceSampleSize: 3,
      cashReceived: 600,
    });
  });

  it('includes dated organization costs without trip links in fleet monthly expenses', async () => {
    repository.findUnlinkedExpenses.mockResolvedValue([
      {
        id: 'outside-trip-expense',
        type: 'INSURANCE',
        amount: 500,
        date: new Date(Date.UTC(2024, 0, 12)),
        routeId: null,
      },
    ]);
    repository.findUnlinkedFuelTransactions.mockResolvedValue([
      {
        id: 'outside-trip-fuel',
        totalAmount: 250,
        date: new Date(Date.UTC(2024, 0, 19)),
        vehicleId: 'vehicle-a',
      },
    ]);
    const result = await service.getOverview('org-a');
    expect(
      result.monthlyActivity.find((item) => item.year === 2024 && item.month === 1),
    ).toMatchObject({ expenses: 3_450, profit: -450, tripCount: 3 });
  });

  it('detects commodity peak volume and profit months separately with a documented strength', async () => {
    const result = await service.getCommodity('org-a', commodityId);
    expect(result.commodity).toMatchObject({
      label: 'Flowers',
      historicalTripCount: 12,
      observedMonths: 6,
      monthOfYearCount: 3,
      yearsObserved: 2,
      sufficientData: true,
      strength: 'STRONG_PATTERN',
      strongestVolumeMonth: 1,
      strongestProfitMonth: 2,
      weakestProfitMonth: 1,
    });
    expect(result.commodity.explanation).toContain('at least 10 trips');
    expect(
      result.commodity.insights.some((insight) =>
        insight.includes('highest trip volume in January'),
      ),
    ).toBe(true);
  });

  it('classifies moderate and weak patterns deterministically and skips under-sampled month peaks', async () => {
    const twoTripsPerMonth = (monthCount: number) =>
      [2024, 2025].flatMap((year) =>
        Array.from({ length: monthCount }, (_, index) => makeTrip(year, index + 1, 0)),
      );
    repository.findCompletedTrips.mockResolvedValue(twoTripsPerMonth(5));
    const moderate = await service.getCommodity('org-a', commodityId);
    expect(moderate.commodity).toMatchObject({
      sufficientData: true,
      strength: 'MODERATE_PATTERN',
      strongestVolumeMonth: null,
    });
    repository.findCompletedTrips.mockResolvedValue(twoTripsPerMonth(7));
    const weak = await service.getCommodity('org-a', commodityId);
    expect(weak.commodity).toMatchObject({
      sufficientData: true,
      strength: 'WEAK_PATTERN',
      strongestVolumeMonth: null,
    });
  });

  it('calculates route-by-commodity seasonal patterns and route labels', async () => {
    const result = await service.getRouteCommodities('org-a', routeId);
    expect(result.data[0]).toMatchObject({
      routeLabel: 'Chennai → Vijayawada',
      commodityName: 'Flowers',
      historicalTripCount: 12,
      strength: 'STRONG_PATTERN',
      strongestVolumeMonth: 1,
    });
    expect(result.data[0].monthlyPatterns.find((item) => item.month === 2)).toMatchObject({
      tripCount: 4,
      averageProfitPerTrip: 600,
      averageMarginPct: 60,
    });
  });

  it('calculates customer monthly history and customer-by-commodity and route patterns', async () => {
    const result = await service.getCustomer('org-a', customerId);
    expect(result).toMatchObject({
      label: 'Acme',
      historicalTripCount: 12,
      strength: 'STRONG_PATTERN',
    });
    expect(result.relatedCommodities).toMatchObject([
      { label: 'Flowers', tripCount: 12, revenue: 12_000 },
    ]);
    expect(result.relatedRoutes).toMatchObject([{ label: 'Chennai → Vijayawada', tripCount: 12 }]);
  });

  it('compares consecutive years for the same month without fabricating missing years', async () => {
    const result = await service.getCommodity('org-a', commodityId);
    expect(
      result.commodity.yearOverYear.find((item) => item.month === 1 && item.year === 2025),
    ).toMatchObject({
      previousYear: 2024,
      tripCountChangePct: 0,
      revenueChangePct: 0,
      profitChangePct: 0,
      marginChangePoints: 0,
    });
    repository.findCompletedTrips.mockResolvedValue(
      history.filter((trip) => trip.startDate.getUTCFullYear() === 2025),
    );
    const singleYear = await service.getCommodity('org-a', commodityId);
    expect(singleYear.commodity.yearOverYear).toEqual([]);
    expect(singleYear.commodity.yearOverYearExplanation).toContain(
      'Year-over-year comparison unavailable',
    );
    expect(singleYear.commodity.explanation).toContain('1 years');
  });

  it('applies year and wraparound month filters to seasonality', async () => {
    const result = await service.getOverview('org-a', { year: 2025, startMonth: 12, endMonth: 2 });
    expect(result.sampleSize).toBe(5);
    expect(
      result.monthlyActivity.every((item) => item.year === 2025 && [1, 2].includes(item.month)),
    ).toBe(true);
  });

  it('withholds peak/low conclusions and classifications for insufficient samples', async () => {
    repository.findCompletedTrips.mockResolvedValue(history.slice(0, 3));
    const result = await service.getCommodity('org-a', commodityId);
    expect(result.commodity).toMatchObject({
      sufficientData: false,
      strength: 'INSUFFICIENT_DATA',
      strongestVolumeMonth: null,
      weakestVolumeMonth: null,
      strongestProfitMonth: null,
      weakestProfitMonth: null,
      yearOverYear: [],
    });
    expect(result.commodity.insights).toEqual([]);
  });

  it('compares an entity with fleet history and scopes all reads to the user organization', async () => {
    const otherCommodityTrips = [
      makeTrip(2024, 1, 10),
      makeTrip(2024, 1, 11),
      makeTrip(2025, 1, 10),
      makeTrip(2025, 1, 11),
    ].map((trip) => ({ ...trip, commodityId: 'another-org-commodity' }));
    repository.findCompletedTrips.mockResolvedValue([...history, ...otherCommodityTrips]);
    const result = await service.compare('org-a', {
      entityType: 'commodity',
      commodityId,
      metric: 'tripCount',
    });
    expect(result).toMatchObject({
      entityType: 'commodity',
      entityId: commodityId,
      metric: 'tripCount',
      sufficientData: true,
    });
    expect(result.data.find((item) => item.month === 1)).toMatchObject({
      entityValue: 6,
      fleetValue: 10,
      sampleSize: 6,
    });
    expect(repository.findCompletedTrips).toHaveBeenCalledWith('org-a');
    expect(repository.findCommodity).toHaveBeenCalledWith('org-a', commodityId);
  });

  it('does not expose a commodity belonging to another organization', async () => {
    repository.findCommodity.mockResolvedValue(null);
    await expect(service.getCommodity('org-b', commodityId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
