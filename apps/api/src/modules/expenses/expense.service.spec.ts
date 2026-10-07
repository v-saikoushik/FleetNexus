import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { ExpenseRepository } from './expense.repository';

describe('ExpenseService', () => {
  let service: ExpenseService;
  const repository = {
    create: jest.fn(),
    findAllByOrganization: jest.fn(),
    findByIdForOrganization: jest.fn(),
    findTripForOrganization: jest.fn(),
    findVehicleForOrganization: jest.fn(),
    findDriverForOrganization: jest.fn(),
    findRouteForOrganization: jest.fn(),
    updateForOrganization: jest.fn(),
    reopenReviewForOrganization: jest.fn(),
  };

  const expense = {
    id: 'expense-a',
    organizationId: 'org-a',
    type: 'TOLL',
    amount: 25,
    date: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findTripForOrganization.mockResolvedValue({ id: 'trip-a' });
    repository.findVehicleForOrganization.mockResolvedValue({ id: 'vehicle-a' });
    repository.findDriverForOrganization.mockResolvedValue({ id: 'driver-a' });
    repository.findRouteForOrganization.mockResolvedValue({ id: 'route-a' });
    service = new ExpenseService(repository as unknown as ExpenseRepository);
  });

  it('creates an expense with organization-scoped relationships', async () => {
    repository.create.mockResolvedValue(expense);
    await expect(
      service.create('org-a', {
        type: 'TOLL',
        amount: 25,
        tripId: 'trip-a',
        vehicleId: 'vehicle-a',
        driverId: 'driver-a',
      }),
    ).resolves.toEqual(expense);

    expect(repository.findTripForOrganization).toHaveBeenCalledWith('trip-a', 'org-a');
    expect(repository.findVehicleForOrganization).toHaveBeenCalledWith('vehicle-a', 'org-a');
    expect(repository.findDriverForOrganization).toHaveBeenCalledWith('driver-a', 'org-a');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: { connect: { id: 'org-a' } },
        trip: { connect: { id: 'trip-a' } },
        vehicle: { connect: { id: 'vehicle-a' } },
        driver: { connect: { id: 'driver-a' } },
        type: 'TOLL',
        amount: 25,
      }),
    );
  });

  it.each([
    ['trip', 'findTripForOrganization'],
    ['vehicle', 'findVehicleForOrganization'],
    ['driver', 'findDriverForOrganization'],
    ['route', 'findRouteForOrganization'],
  ] as const)('rejects a missing or cross-organization %s', async (name, method) => {
    repository[method].mockResolvedValue(null);
    await expect(
      service.create('org-a', { type: 'TOLL', amount: 25, [`${name}Id`]: `${name}-b` }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists only the organization records and passes supported filters', async () => {
    repository.findAllByOrganization.mockResolvedValue([expense]);
    const result = await service.findAll('org-a', {
      driverId: 'driver-a',
      type: 'TOLL',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
    });
    expect(result).toEqual([expense]);
    expect(repository.findAllByOrganization).toHaveBeenCalledWith('org-a', {
      tripId: undefined,
      vehicleId: undefined,
      driverId: 'driver-a',
      type: 'TOLL',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.000Z'),
    });
  });

  it('rejects an inverted date range', () => {
    expect(() =>
      service.findAll('org-a', {
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
    expect(repository.findAllByOrganization).not.toHaveBeenCalled();
  });

  it('returns an organization-scoped expense', async () => {
    repository.findByIdForOrganization.mockResolvedValue(expense);
    await expect(service.findOne('org-a', 'expense-a')).resolves.toEqual(expense);
    expect(repository.findByIdForOrganization).toHaveBeenCalledWith('expense-a', 'org-a');
  });

  it('hides expenses owned by another organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(null);
    await expect(service.findOne('org-a', 'expense-b')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('org-a', 'expense-b', { amount: 30 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.updateForOrganization).not.toHaveBeenCalled();
  });

  it('updates the expense only within its organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(expense);
    repository.updateForOrganization.mockResolvedValue({ ...expense, amount: 30 });
    await expect(service.update('org-a', 'expense-a', { amount: 30 })).resolves.toMatchObject({
      amount: 30,
    });
    expect(repository.updateForOrganization).toHaveBeenCalledWith('expense-a', 'org-a', {
      amount: 30,
    });
  });

  it('rejects adding or moving an expense onto finalized trip financials', async () => {
    repository.findTripForOrganization.mockResolvedValue({
      id: 'trip-a',
      financialStatus: 'FINALIZED',
    });
    await expect(
      service.create('org-a', { type: 'TOLL', amount: 25, tripId: 'trip-a' }),
    ).rejects.toThrow(/reopen financials/i);
    repository.findByIdForOrganization.mockResolvedValue({ ...expense, tripId: 'trip-a' });
    await expect(service.update('org-a', 'expense-a', { amount: 30 })).rejects.toThrow(
      /reopen financials/i,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.updateForOrganization).not.toHaveBeenCalled();
  });

  it('invalidates a ready financial review after a linked expense changes', async () => {
    repository.findTripForOrganization.mockResolvedValue({
      id: 'trip-a',
      financialStatus: 'READY_FOR_REVIEW',
    });
    repository.create.mockResolvedValue(expense);
    await service.create('org-a', { type: 'TOLL', amount: 25, tripId: 'trip-a' });
    expect(repository.reopenReviewForOrganization).toHaveBeenCalledWith('trip-a', 'org-a');
  });
});
