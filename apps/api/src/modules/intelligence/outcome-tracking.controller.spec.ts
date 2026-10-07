import { ForbiddenException } from '@nestjs/common';
import { OutcomeTrackingController } from './outcome-tracking.controller';

describe('OutcomeTrackingController', () => {
  it('uses the authenticated organization when listing outcomes', async () => {
    const outcomes = { list: jest.fn().mockResolvedValue([]) };
    const controller = new OutcomeTrackingController(outcomes as never);
    await controller.list({ organizationId: 'org-1' } as never);
    expect(outcomes.list).toHaveBeenCalledWith('org-1');
  });

  it('rejects requests without an authenticated organization before fetching', async () => {
    const outcomes = { list: jest.fn() };
    const controller = new OutcomeTrackingController(outcomes as never);
    await expect(controller.list({ organizationId: null } as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(outcomes.list).not.toHaveBeenCalled();
  });
});
