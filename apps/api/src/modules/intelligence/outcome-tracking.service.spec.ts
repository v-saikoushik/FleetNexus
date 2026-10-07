import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OutcomeTrackingService } from './outcome-tracking.service';

const prediction = {
  id: 'pred-1',
  organizationId: 'org-1',
  tripId: null,
  decision: 'ACCEPT',
  methodVersion: 'decision-support-v1',
  inputSnapshot: {
    routeId: 'route-1',
    vehicleId: 'vehicle-1',
    commodityId: 'commodity-1',
    customerId: 'customer-1',
  },
  predictionSnapshot: {
    expectedRevenue: { amount: 2000 },
    expectedCost: { total: 500 },
    expectedProfit: 1500,
    expectedMarginPct: 75,
    costPerKm: 5,
    profitPerKm: 15,
  },
  analyzedAt: new Date('2026-01-01T00:00:00Z'),
  outcomeStatus: 'PENDING',
};
const completedTrip = {
  id: 'trip-1',
  tripNumber: 'TRP-1',
  organizationId: 'org-1',
  routeId: 'route-1',
  vehicleId: 'vehicle-1',
  customerId: 'customer-1',
  commodityId: 'commodity-1',
  status: 'COMPLETED',
  financialStatus: 'FINALIZED',
  actualFreight: 2100,
  estimatedFreight: 2000,
  actualDistanceKm: 100,
  estimatedDistanceKm: 100,
  originName: 'A',
  destinationName: 'B',
  expenses: [{ type: 'TOLL', amount: 300 }],
  fuelTransactions: [{ totalAmount: 400, litres: 10 }],
  payments: [{ amount: 1000, status: 'PAID' }],
  vehicle: { registrationNumber: 'ABC' },
  commodity: { name: 'Grain' },
  route: null,
};

describe('OutcomeTrackingService', () => {
  const setup = () => {
    const db = {
      loadPrediction: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      trip: { findFirst: jest.fn() },
    };
    return { service: new OutcomeTrackingService(db as never), db };
  };

  it('links an organization-owned compatible trip explicitly and returns the prediction comparison', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst
      .mockResolvedValueOnce(prediction)
      .mockResolvedValueOnce({ ...prediction, tripId: 'trip-1', trip: completedTrip });
    db.trip.findFirst.mockResolvedValue(completedTrip);
    const result = await service.linkTrip('org-1', 'pred-1', 'trip-1');
    expect(db.loadPrediction.update).toHaveBeenCalledWith({
      where: { id: 'pred-1' },
      data: { tripId: 'trip-1' },
    });
    expect(result.outcomeStatus).toBe('COMPLETED');
    expect(result.actual).toMatchObject({
      revenue: 2100,
      cashReceived: 1000,
      cost: 700,
      profit: 1400,
    });
    expect(result.comparison!.profit).toMatchObject({ predicted: 1500, actual: 1400, error: -100 });
    expect(result.comparison!.margin.differencePoints).toBeCloseTo(-8.33, 2);
  });

  it('rejects cross-organization prediction access without disclosing its data', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue(null);
    await expect(service.get('org-2', 'pred-1')).rejects.toThrow(NotFoundException);
    expect(db.loadPrediction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pred-1', organizationId: 'org-2' } }),
    );
  });

  it('rejects invalid or cross-organization trips', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue(prediction);
    db.trip.findFirst.mockResolvedValue(null);
    await expect(service.linkTrip('org-1', 'pred-1', 'foreign-trip')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign-trip', organizationId: 'org-1' } }),
    );
  });

  it('rejects trip compatibility mismatches', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue(prediction);
    db.trip.findFirst.mockResolvedValue({ ...completedTrip, routeId: 'route-2' });
    await expect(service.linkTrip('org-1', 'pred-1', 'trip-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('prevents linking a prediction twice', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue({ ...prediction, tripId: 'trip-1' });
    await expect(service.linkTrip('org-1', 'pred-1', 'trip-2')).rejects.toThrow(ConflictException);
    expect(db.trip.findFirst).not.toHaveBeenCalled();
  });

  it('reports incomplete actual data rather than finalizing estimated freight as ground truth', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue({
      ...prediction,
      tripId: 'trip-1',
      trip: { ...completedTrip, financialStatus: 'OPEN', actualFreight: null, expenses: [] },
    });
    const result = await service.comparison('org-1', 'pred-1');
    expect(result.outcomeStatus).toBe('INSUFFICIENT_ACTUAL_DATA');
    expect(result.actual).toBeNull();
    expect(result.message).toBe('Waiting for financial finalization.');
  });

  it('does not treat a completed Trip with OPEN financials as reliable actual outcome', async () => {
    const { service, db } = setup();
    db.loadPrediction.findFirst.mockResolvedValue({
      ...prediction,
      tripId: 'trip-1',
      trip: { ...completedTrip, financialStatus: 'OPEN' },
    });
    const result = await service.comparison('org-1', 'pred-1');
    expect(result.outcomeStatus).toBe('INSUFFICIENT_ACTUAL_DATA');
    expect(result.actual).toBeNull();
    expect(result.message).toBe('Waiting for financial finalization.');
  });

  it('returns insufficient-data messaging below the calibration sample threshold', async () => {
    const { service, db } = setup();
    db.loadPrediction.findMany.mockResolvedValue(
      Array.from({ length: 4 }, (_, index) => ({ ...prediction, id: `p-${index}` })),
    );
    const result = await service.summary('org-1');
    expect(result.sufficientData).toBe(false);
    expect(result.message).toBe('Insufficient outcome data.');
  });

  it('aggregates completed recommendation outcomes and route error only at the sample threshold', async () => {
    const { service, db } = setup();
    const rows = Array.from({ length: 5 }, (_, index) => ({
      ...prediction,
      id: `pred-${index}`,
      decision: index < 3 ? 'ACCEPT' : index === 3 ? 'REVIEW' : 'AVOID',
      tripId: `trip-${index}`,
      trip: { ...completedTrip, id: `trip-${index}` },
    }));
    db.loadPrediction.findMany.mockResolvedValue(rows);
    const result = await service.summary('org-1');
    expect(result.sufficientData).toBe(true);
    expect(result.completed).toBe(5);
    expect(result.recommendationPerformance).toEqual([
      { decision: 'ACCEPT', completed: 3, profitable: 3 },
      { decision: 'REVIEW', completed: 1, profitable: 1 },
      { decision: 'AVOID', completed: 1, profitable: 1 },
    ]);

    const byRoute = await service.aggregate('org-1', 'route');
    expect(byRoute).toEqual([
      expect.objectContaining({
        label: 'A → B',
        sampleSize: 5,
        sufficientData: true,
        averagePredictedProfit: 1500,
        averageActualProfit: 1400,
        averageProfitError: -100,
      }),
    ]);
  });
});
