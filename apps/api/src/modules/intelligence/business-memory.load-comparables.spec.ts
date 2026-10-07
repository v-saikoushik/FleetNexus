import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessMemoryService } from './business-memory.service';

const makeTrip = (id: string, routeId = 'route-1', commodityId = 'commodity-1') => ({
  id,
  tripNumber: id,
  startDate: new Date('2025-01-10T00:00:00Z'),
  vehicleId: 'vehicle-1',
  routeId,
  customerId: 'customer-1',
  commodityId,
  originName: 'Chennai',
  destinationName: 'Vijayawada',
  actualFreight: 10_000,
  estimatedFreight: null,
  actualDistanceKm: 300,
  estimatedDistanceKm: null,
  loadWeightTons: 5,
  expenses: [{ id: `expense-${id}`, type: 'TOLL', amount: 400 }],
  fuelTransactions: [{ id: `fuel-${id}`, litres: 30, totalAmount: 3_000 }],
  payments: [],
});

describe('BusinessMemoryService load comparables', () => {
  const makeRepository = (trips = [makeTrip('trip-1')]) => ({
    findCustomerForOrganization: jest.fn().mockResolvedValue({ id: 'customer-1', name: 'Acme' }),
    findRouteForOrganization: jest.fn().mockResolvedValue({
      id: 'route-1',
      originLocationId: 'origin',
      destinationLocationId: 'destination',
      estimatedDistance: 300,
    }),
    findCommodityForOrganization: jest.fn().mockResolvedValue({ id: 'commodity-1', name: 'Grain' }),
    findVehicleForOrganization: jest.fn().mockResolvedValue({
      id: 'vehicle-1',
      registrationNumber: 'AB-01',
      vehicleType: 'TRUCK',
      capacityTons: 10,
    }),
    findCompletedTrips: jest.fn().mockResolvedValue(trips),
    findVehicles: jest
      .fn()
      .mockResolvedValue([
        { id: 'vehicle-1', registrationNumber: 'AB-01', vehicleType: 'TRUCK', capacityTons: 10 },
      ]),
    findCustomers: jest.fn().mockResolvedValue([{ id: 'customer-1', name: 'Acme' }]),
    findCommodities: jest.fn().mockResolvedValue([{ id: 'commodity-1', name: 'Grain' }]),
    findRoutes: jest
      .fn()
      .mockResolvedValue([
        { id: 'route-1', originLocationId: 'origin', destinationLocationId: 'destination' },
      ]),
    findLocations: jest.fn().mockResolvedValue([
      { id: 'origin', name: 'Chennai' },
      { id: 'destination', name: 'Vijayawada' },
    ]),
    findFreightRates: jest.fn().mockResolvedValue([]),
  });

  it('requires the same route and commodity and explains secondary similarities', async () => {
    const repo = makeRepository([
      makeTrip('primary'),
      makeTrip('other-route', 'route-2'),
      makeTrip('other-commodity', 'route-1', 'commodity-2'),
    ]);
    const result = await new BusinessMemoryService(repo as never).getLoadComparables('org-1', {
      routeId: 'route-1',
      commodityId: 'commodity-1',
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      distanceKm: 300,
      proposedDate: new Date('2025-01-15T00:00:00Z'),
      loadWeightTons: 5,
    });
    expect(result.sampleSize).toBe(1);
    expect(result.trips[0].similarityReasons).toEqual(
      expect.arrayContaining([
        'Same route',
        'Same commodity',
        'Same customer',
        'Same vehicle',
        'Similar distance',
        'Same calendar quarter',
      ]),
    );
    expect(result.trips[0].totalCost).toBe(3_400);
    expect(repo.findCompletedTrips).toHaveBeenCalledWith('org-1');
  });

  it('validates every referenced entity within the organization and enforces selected vehicle capacity', async () => {
    const repo = makeRepository();
    repo.findRouteForOrganization.mockResolvedValueOnce(null);
    const memory = new BusinessMemoryService(repo as never);
    await expect(
      memory.getLoadComparables('org-1', {
        routeId: 'foreign',
        commodityId: 'commodity-1',
        proposedDate: new Date(),
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.findRouteForOrganization).toHaveBeenCalledWith('org-1', 'foreign');
    await expect(
      memory.getLoadComparables('org-1', {
        routeId: 'route-1',
        commodityId: 'commodity-1',
        vehicleId: 'vehicle-1',
        loadWeightTons: 11,
        proposedDate: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects customer, commodity, and vehicle references outside the organization', async () => {
    const repo = makeRepository();
    const memory = new BusinessMemoryService(repo as never);
    repo.findCustomerForOrganization.mockResolvedValueOnce(null);
    await expect(
      memory.getLoadComparables('org-1', {
        routeId: 'route-1',
        commodityId: 'commodity-1',
        customerId: 'foreign-customer',
        proposedDate: new Date(),
      }),
    ).rejects.toThrow(NotFoundException);
    repo.findCommodityForOrganization.mockResolvedValueOnce(null);
    await expect(
      memory.getLoadComparables('org-1', {
        routeId: 'route-1',
        commodityId: 'foreign-commodity',
        proposedDate: new Date(),
      }),
    ).rejects.toThrow(NotFoundException);
    repo.findVehicleForOrganization.mockResolvedValueOnce(null);
    await expect(
      memory.getLoadComparables('org-1', {
        routeId: 'route-1',
        commodityId: 'commodity-1',
        vehicleId: 'foreign-vehicle',
        proposedDate: new Date(),
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
