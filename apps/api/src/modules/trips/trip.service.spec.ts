import { ConflictException, NotFoundException } from '@nestjs/common';
import { TripRepository } from './trip.repository';
import { TripService } from './trip.service';

const makeTrip = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  organizationId: 'org-1',
  tripNumber: 'TRP-1',
  status: 'COMPLETED',
  financialStatus: 'OPEN',
  financialFinalizedAt: null,
  financialFinalizedById: null,
  actualFreight: 50_000,
  estimatedFreight: 48_000,
  actualDistanceKm: 100,
  estimatedDistanceKm: 95,
  loadWeightTons: null,
  expenses: [{ type: 'DRIVER_ALLOWANCE', amount: 5_000 }],
  fuelTransactions: [{ litres: 100, totalAmount: 15_000 }],
  payments: [],
  endDate: new Date(),
  startDate: new Date(),
  ...overrides,
});

describe('Trip financial finalization', () => {
  const setup = () => {
    const repository = { findByIdForOrganization: jest.fn(), update: jest.fn() };
    const prisma = { trip: { updateMany: jest.fn() } };
    return {
      service: new TripService(repository as unknown as TripRepository, prisma as never),
      repository,
      prisma,
    };
  };

  it('reviews recorded amounts without treating missing categories as verified zero', async () => {
    const { service, repository, prisma } = setup();
    repository.findByIdForOrganization.mockResolvedValue(makeTrip());
    prisma.trip.updateMany.mockResolvedValue({ count: 1 });
    const review = await service.reviewFinancials('org-1', 'trip-1');
    expect(review.ready).toBe(true);
    expect(review.financialStatus).toBe('READY_FOR_REVIEW');
    expect(review.financialSummary).toMatchObject({
      revenue: 50_000,
      revenueBasis: 'ACTUAL',
      expenses: {
        total: 20_000,
        fuel: { amount: 15_000, status: 'RECORDED' },
        driver: { amount: 5_000, status: 'RECORDED' },
        toll: { amount: 0, status: 'MISSING' },
      },
      recordedProfit: 30_000,
      recordedMarginPct: 60,
    });
    expect(review.missingExpenseCategories).toContain('toll');
    expect(review.warnings.join(' ')).toContain('Absence is not treated as verified zero');
    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trip-1', organizationId: 'org-1', financialStatus: { not: 'FINALIZED' } },
        data: { financialStatus: 'READY_FOR_REVIEW' },
      }),
    );
  });

  it('blocks review readiness when actual freight or distance is missing', async () => {
    const { service, repository } = setup();
    repository.findByIdForOrganization.mockResolvedValue(
      makeTrip({ actualFreight: null, actualDistanceKm: null, estimatedDistanceKm: null }),
    );
    const review = await service.reviewFinancials('org-1', 'trip-1');
    expect(review.ready).toBe(false);
    expect(review.blockingIssues).toContain('Actual trip freight is missing.');
    expect(review.blockingIssues).toContain('Actual trip distance is missing.');
    expect(review.financialSummary.recordedProfit).toBeNull();
  });

  it('does not finalize cost-per-kilometre using estimated distance as actual', async () => {
    const { service, repository } = setup();
    repository.findByIdForOrganization.mockResolvedValue(
      makeTrip({ actualDistanceKm: null, estimatedDistanceKm: 100 }),
    );
    const review = await service.reviewFinancials('org-1', 'trip-1');
    expect(review.ready).toBe(false);
    expect(review.financialSummary.distanceBasis).toBe('ESTIMATED');
    expect(review.financialSummary.costPerKm).toBeNull();
    expect(review.blockingIssues).toContain('Actual trip distance is missing.');
  });

  it('requires review, finalizes atomically with actor metadata, and supports idempotent repeat', async () => {
    const { service, repository, prisma } = setup();
    repository.findByIdForOrganization.mockResolvedValueOnce(makeTrip());
    const notReviewed = await service.finalizeFinancials('org-1', 'trip-1', 'user-1');
    expect(notReviewed.status).toBe('NOT_READY');
    expect(notReviewed.blockingIssues).toContain(
      'Complete the financial review before finalizing.',
    );

    repository.findByIdForOrganization.mockResolvedValueOnce(
      makeTrip({ financialStatus: 'READY_FOR_REVIEW' }),
    );
    prisma.trip.updateMany.mockResolvedValueOnce({ count: 1 });
    const finalized = await service.finalizeFinancials('org-1', 'trip-1', 'user-1');
    expect(finalized.status).toBe('FINALIZED');
    expect(prisma.trip.updateMany).toHaveBeenCalledTimes(1);

    repository.findByIdForOrganization.mockResolvedValueOnce(
      makeTrip({ financialStatus: 'FINALIZED' }),
    );
    const repeated = await service.finalizeFinancials('org-1', 'trip-1', 'user-1');
    expect(repeated.status).toBe('FINALIZED');
    expect(prisma.trip.updateMany).toHaveBeenCalledTimes(1);
  });

  it('reopens only finalized financials and clears current-finalization metadata', async () => {
    const { service, repository, prisma } = setup();
    repository.findByIdForOrganization.mockResolvedValue(
      makeTrip({ financialStatus: 'FINALIZED' }),
    );
    prisma.trip.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.reopenFinancials('org-1', 'trip-1')).resolves.toMatchObject({
      financialStatus: 'OPEN',
    });
    expect(prisma.trip.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-1', organizationId: 'org-1', financialStatus: 'FINALIZED' },
      data: { financialStatus: 'OPEN', financialFinalizedAt: null, financialFinalizedById: null },
    });
  });

  it('enforces organization scope and prevents normal edits after finalization', async () => {
    const { service, repository } = setup();
    repository.findByIdForOrganization.mockResolvedValue(null);
    await expect(service.reviewFinancials('org-2', 'trip-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.finalizeFinancials('org-2', 'trip-1', 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.reopenFinancials('org-2', 'trip-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repository.findByIdForOrganization.mockResolvedValue(
      makeTrip({ financialStatus: 'FINALIZED' }),
    );
    await expect(
      service.update('org-1', 'trip-1', { actualFreight: 60_000 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reopening financials that are not finalized', async () => {
    const { service, repository, prisma } = setup();
    repository.findByIdForOrganization.mockResolvedValue(makeTrip());
    await expect(service.reopenFinancials('org-1', 'trip-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.trip.updateMany).not.toHaveBeenCalled();
  });
});
