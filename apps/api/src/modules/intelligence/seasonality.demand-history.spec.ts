import { NotFoundException } from '@nestjs/common';
import { SeasonalityService } from './seasonality.service';

describe('SeasonalityService demand history', () => {
  const trip = (id: string, date: string) => ({
    id,
    startDate: new Date(`${date}T00:00:00Z`),
    routeId: 'route-1',
    commodityId: 'commodity-1',
    customerId: null,
    originName: null,
    destinationName: null,
    actualFreight: null,
    estimatedFreight: null,
    actualDistanceKm: null,
    estimatedDistanceKm: null,
    expenses: [],
    fuelTransactions: [],
    payments: [],
  });
  const repository = (trips: ReturnType<typeof trip>[]) => ({
    findCommodity: jest.fn().mockResolvedValue({ id: 'commodity-1', name: 'Flowers' }),
    findRoute: jest.fn().mockResolvedValue({
      id: 'route-1',
      originLocationId: 'origin',
      destinationLocationId: 'destination',
    }),
    findCompletedTrips: jest.fn().mockResolvedValue(trips),
    findCommodities: jest.fn().mockResolvedValue([{ id: 'commodity-1', name: 'Flowers' }]),
    findCustomers: jest.fn().mockResolvedValue([]),
    findRoutes: jest
      .fn()
      .mockResolvedValue([
        { id: 'route-1', originLocationId: 'origin', destinationLocationId: 'destination' },
      ]),
    findLocations: jest.fn().mockResolvedValue([
      { id: 'origin', name: 'Chennai' },
      { id: 'destination', name: 'Vijayawada' },
    ]),
    findUnlinkedExpenses: jest.fn().mockResolvedValue([]),
    findUnlinkedFuelTransactions: jest.fn().mockResolvedValue([]),
  });

  it('fills only missing months between observed completed-trip months with zero demand', async () => {
    const repo = repository([trip('1', '2024-01-15'), trip('2', '2024-03-15')]);
    const result = await new SeasonalityService(repo as never).getDemandHistory('org-a', {
      commodityId: 'commodity-1',
      routeId: 'route-1',
    });
    expect(result.series).toEqual([
      { year: 2024, month: 1, tripCount: 1 },
      { year: 2024, month: 2, tripCount: 0 },
      { year: 2024, month: 3, tripCount: 1 },
    ]);
    expect(repo.findCompletedTrips).toHaveBeenCalledWith('org-a');
    expect(repo.findRoute).toHaveBeenCalledWith('org-a', 'route-1');
  });

  it('rejects commodity IDs outside the requested organization', async () => {
    const repo = repository([]);
    repo.findCommodity.mockResolvedValue(null);
    await expect(
      new SeasonalityService(repo as never).getDemandHistory('org-a', {
        commodityId: 'foreign-commodity',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.findCommodity).toHaveBeenCalledWith('org-a', 'foreign-commodity');
  });
});
