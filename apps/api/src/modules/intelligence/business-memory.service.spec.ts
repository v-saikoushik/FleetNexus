import { NotFoundException } from '@nestjs/common';
import { BusinessMemoryRepository } from './business-memory.repository';
import { BusinessMemoryService } from './business-memory.service';

describe('BusinessMemoryService', () => {
  const repository = {
    findCompletedTrips: jest.fn(),
    findVehicles: jest.fn(),
    findCustomers: jest.fn(),
    findCommodities: jest.fn(),
    findRoutes: jest.fn(),
    findLocations: jest.fn(),
    findFreightRates: jest.fn(),
    findTripById: jest.fn(),
    findCustomerForOrganization: jest.fn(),
    findRouteForOrganization: jest.fn(),
    findCommodityForOrganization: jest.fn(),
    findVehicleForOrganization: jest.fn(),
  };
  let service: BusinessMemoryService;
  const trip = {
    id: 'trip-a',
    tripNumber: 'T-1',
    startDate: new Date('2026-05-01'),
    vehicleId: 'vehicle-a',
    routeId: 'route-a',
    customerId: 'customer-a',
    commodityId: 'commodity-a',
    originName: 'Pune',
    destinationName: 'Mumbai',
    actualFreight: 1_000,
    estimatedFreight: 900,
    actualDistanceKm: 150,
    estimatedDistanceKm: 140,
    loadWeightTons: 10,
    expenses: [{ id: 'expense-a', type: 'TOLL', amount: 100 }],
    fuelTransactions: [{ id: 'fuel-a', litres: 10, totalAmount: 200 }],
    payments: [{ id: 'payment-a', amount: 300, status: 'PARTIAL' }],
  };
  const defaults = () => {
    repository.findCompletedTrips.mockResolvedValue([trip]);
    repository.findVehicles.mockResolvedValue([
      { id: 'vehicle-a', registrationNumber: 'KA01AA0001' },
    ]);
    repository.findCustomers.mockResolvedValue([{ id: 'customer-a', name: 'Acme' }]);
    repository.findCommodities.mockResolvedValue([{ id: 'commodity-a', name: 'Steel' }]);
    repository.findRoutes.mockResolvedValue([
      { id: 'route-a', originLocationId: 'loc-a', destinationLocationId: 'loc-b' },
    ]);
    repository.findLocations.mockResolvedValue([
      { id: 'loc-a', name: 'Pune' },
      { id: 'loc-b', name: 'Mumbai' },
    ]);
    repository.findFreightRates.mockResolvedValue([
      {
        id: 'rate-new',
        routeId: 'route-a',
        commodityId: 'commodity-a',
        vehicleType: 'TRUCK',
        freightAmount: 1_100,
        rateBasis: 'PER_TON',
        effectiveDate: new Date('2026-05-01'),
      },
      {
        id: 'rate-old',
        routeId: 'route-a',
        commodityId: 'commodity-a',
        vehicleType: 'TRUCK',
        freightAmount: 1_000,
        rateBasis: 'PER_TON',
        effectiveDate: new Date('2026-01-01'),
      },
    ]);
  };
  beforeEach(() => {
    jest.resetAllMocks();
    defaults();
    repository.findTripById.mockResolvedValue({
      id: 'trip-a',
      routeId: 'route-a',
      customerId: 'customer-a',
      commodityId: 'commodity-a',
      vehicleId: 'vehicle-a',
    });
    repository.findCustomerForOrganization.mockResolvedValue({ id: 'customer-a', name: 'Acme' });
    repository.findRouteForOrganization.mockResolvedValue({
      id: 'route-a',
      originLocationId: 'loc-a',
      destinationLocationId: 'loc-b',
    });
    repository.findCommodityForOrganization.mockResolvedValue({ id: 'commodity-a', name: 'Steel' });
    repository.findVehicleForOrganization.mockResolvedValue({
      id: 'vehicle-a',
      registrationNumber: 'KA01AA0001',
      vehicleType: 'TRUCK',
      capacityTons: 10,
    });
    service = new BusinessMemoryService(repository as unknown as BusinessMemoryRepository);
  });

  it('summarizes customer, route, commodity, vehicle, rate, and trip history', async () => {
    const result = await service.getOverview('org-a');
    expect(result).toMatchObject({ sampleSize: 1, pricedTripCount: 1, confidence: 'INSUFFICIENT' });
    expect(result.customers[0]).toMatchObject({
      label: 'Acme',
      tripCount: 1,
      totalRevenue: 1_000,
      totalCost: 300,
      totalProfit: 700,
      averageCostPerKm: 2,
    });
    expect(result.routes[0].label).toBe('Pune → Mumbai');
    expect(result.commodities[0].label).toBe('Steel');
    expect(result.vehicles[0].label).toBe('KA01AA0001');
    expect(result.freightRates[0]).toMatchObject({
      sampleSize: 2,
      minimumRate: 1_000,
      averageRate: 1_050,
      maximumRate: 1_100,
      latestRate: 1_100,
    });
    expect(result.historicalTrips[0]).toMatchObject({
      profitabilityBasis: 'ACTUAL',
      cashReceived: 300,
      outstanding: 700,
    });
    for (const method of [
      'findCompletedTrips',
      'findVehicles',
      'findCustomers',
      'findCommodities',
      'findRoutes',
      'findLocations',
      'findFreightRates',
    ] as const) {
      expect(repository[method]).toHaveBeenCalledWith('org-a');
    }
  });

  it('withholds profit when a group includes trips missing freight and labels the sample', async () => {
    repository.findCompletedTrips.mockResolvedValue([
      trip,
      { ...trip, id: 'trip-b', tripNumber: 'T-2', actualFreight: null, estimatedFreight: null },
    ]);
    const result = await service.getOverview('org-a');
    expect(result.customers[0]).toMatchObject({
      tripCount: 2,
      pricedTripCount: 1,
      totalProfit: null,
      confidence: 'INSUFFICIENT',
    });
    expect(result.customers[0].explanation).toContain('freight is missing');
  });

  it('uses estimated freight when actual freight is missing', async () => {
    repository.findCompletedTrips.mockResolvedValue([{ ...trip, actualFreight: null }]);
    const result = await service.getOverview('org-a');
    expect(result.historicalTrips[0]).toMatchObject({
      revenue: 900,
      profitabilityBasis: 'ESTIMATED',
    });
  });

  it('provides selected customer, route, commodity, and vehicle history', async () => {
    const [customer, route, commodity, vehicle] = await Promise.all([
      service.getCustomerHistory('org-a', 'customer-a'),
      service.getRouteHistory('org-a', 'route-a'),
      service.getCommodityHistory('org-a', 'commodity-a'),
      service.getVehicleHistory('org-a', 'vehicle-a'),
    ]);
    expect(customer).toMatchObject({
      tripCount: 1,
      totalRevenue: 1_000,
      totalPaymentsReceived: 300,
      outstanding: 700,
      totalExpenses: 300,
      totalProfit: 700,
      averageFreightPerTrip: 1_000,
      averageProfitPerTrip: 700,
      commodities: ['Steel'],
      routes: ['Pune → Mumbai'],
    });
    expect(route.tripDates).toEqual(['2026-05-01T00:00:00.000Z']);
    expect(commodity.customers).toEqual(['Acme']);
    expect(vehicle).toMatchObject({ fuelCost: 200, customers: ['Acme'], vehicles: ['KA01AA0001'] });
  });

  it('returns freight history and explicitly labels a low sample', async () => {
    const result = await service.getFreightHistory('org-a', 'route-a', 'commodity-a', 'customer-a');
    expect(result).toMatchObject({
      comparableTripCount: 1,
      minimumFreight: 1_000,
      maximumFreight: 1_000,
      averageFreight: 1_000,
      mostRecentFreight: 1_000,
      averageProfit: 700,
      averageMarginPct: 70,
      recordedRateCount: 2,
    });
    expect(result.explanation).toContain('Insufficient historical data.');
  });

  it('returns explainable similar trips and excludes the reference trip', async () => {
    repository.findCompletedTrips.mockResolvedValue([
      trip,
      { ...trip, id: 'trip-b', tripNumber: 'T-2' },
      {
        ...trip,
        id: 'trip-c',
        routeId: null,
        customerId: null,
        commodityId: null,
        vehicleId: 'vehicle-b',
      },
    ]);
    const result = await service.getSimilarTrips('org-a', 'trip-a', 5);
    expect(repository.findTripById).toHaveBeenCalledWith('org-a', 'trip-a');
    expect(result.sampleSize).toBe(1);
    expect(result.data[0].similarityReasons).toContain('Same saved route');
    expect(result.data[0].tripId).toBe('trip-b');
  });

  it('rejects a trip outside the authenticated organization and handles no history', async () => {
    repository.findTripById.mockResolvedValue(null);
    await expect(service.getSimilarTrips('org-a', 'foreign-trip')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repository.findCompletedTrips.mockResolvedValue([]);
    const result = await service.getOverview('org-a');
    expect(result).toMatchObject({
      sampleSize: 0,
      confidence: 'INSUFFICIENT',
      customers: [],
      routes: [],
      historicalTrips: [],
    });
    expect(result.explanation).toContain('No completed trips');
  });

  it('rejects cross-organization entity references and missing similarity criteria', async () => {
    repository.findCustomerForOrganization.mockResolvedValue(null);
    await expect(service.getCustomerHistory('org-a', 'foreign-customer')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getSimilarTripsByCriteria('org-a', { limit: 10 })).rejects.toThrow(
      'at least one similarity field',
    );
    expect(repository.findCustomerForOrganization).toHaveBeenCalledWith(
      'org-a',
      'foreign-customer',
    );
  });
});
