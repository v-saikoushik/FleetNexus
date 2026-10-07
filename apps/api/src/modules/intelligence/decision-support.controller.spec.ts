import { ForbiddenException } from '@nestjs/common';
import { DecisionSupportController } from './decision-support.controller';

describe('DecisionSupportController', () => {
  it('uses the authenticated organization and the shared proposed-load input', async () => {
    const decisions = { analyze: jest.fn().mockResolvedValue({ decision: 'REVIEW' }) };
    const controller = new DecisionSupportController(decisions as never);
    const dto = { routeId: 'route', commodityId: 'commodity', offeredFreight: 1000 };
    const result = await controller.analyze({ organizationId: 'org-1' } as never, dto as never);
    expect(decisions.analyze).toHaveBeenCalledWith('org-1', dto);
    expect(result.success).toBe(true);
  });

  it('forbids a request without an authenticated organization', async () => {
    const decisions = { analyze: jest.fn() };
    const controller = new DecisionSupportController(decisions as never);
    await expect(
      controller.analyze({ organizationId: null } as never, {} as never),
    ).rejects.toThrow(ForbiddenException);
    expect(decisions.analyze).not.toHaveBeenCalled();
  });
});
