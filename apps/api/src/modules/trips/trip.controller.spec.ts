import { ForbiddenException } from '@nestjs/common';
import { TripController } from './trip.controller';

describe('Trip financial action authorization scope', () => {
  it('uses the caller organization and user id for finalization', async () => {
    const trips = { finalizeFinancials: jest.fn().mockResolvedValue({ status: 'FINALIZED' }) };
    const controller = new TripController(trips as never);
    await controller.finalizeFinancials(
      { organizationId: 'org-1', userId: 'user-1' } as never,
      'trip-1',
    );
    expect(trips.finalizeFinancials).toHaveBeenCalledWith('org-1', 'trip-1', 'user-1');
  });

  it('rejects financial review without an authenticated organization', async () => {
    const trips = { reviewFinancials: jest.fn() };
    const controller = new TripController(trips as never);
    await expect(
      controller.reviewFinancials({ organizationId: null } as never, 'trip-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(trips.reviewFinancials).not.toHaveBeenCalled();
  });
});
