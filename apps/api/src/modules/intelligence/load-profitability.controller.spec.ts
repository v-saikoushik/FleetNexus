import { ForbiddenException } from '@nestjs/common';
import { LoadProfitabilityController } from './load-profitability.controller';

describe('LoadProfitabilityController', () => {
  it('passes the authenticated organization to the calculation service', async () => {
    const service = { analyze: jest.fn().mockResolvedValue({ analysisStatus: 'LIMITED' }) };
    const controller = new LoadProfitabilityController(service as never);
    const result = await controller.analyze(
      { organizationId: 'org-a' } as never,
      { routeId: 'r', commodityId: 'c' } as never,
    );
    expect(service.analyze).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ routeId: 'r' }),
    );
    expect(result.success).toBe(true);
  });

  it('forbids users without an organization', async () => {
    const service = { analyze: jest.fn() };
    const controller = new LoadProfitabilityController(service as never);
    await expect(
      controller.analyze({ organizationId: null } as never, {} as never),
    ).rejects.toThrow(ForbiddenException);
    expect(service.analyze).not.toHaveBeenCalled();
  });
});
