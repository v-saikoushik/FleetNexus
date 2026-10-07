import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

describe('FinanceController', () => {
  let app: INestApplication<App>;
  const finance = {
    getSummary: jest.fn(),
    getExpenses: jest.fn(),
    getVehicles: jest.fn(),
    getTrips: jest.fn(),
    getCashFlow: jest.fn(),
    getOutstanding: jest.fn(),
    getInsights: jest.fn(),
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [{ provide: FinanceService, useValue: finance }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { headers: { authorization?: string }; user?: unknown };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          const token = req.headers.authorization?.replace(/^Bearer /, '');
          if (!token) throw new UnauthorizedException();
          req.user = {
            userId: 'user-a',
            email: 'owner@example.com',
            role: token === 'driver' ? 'DRIVER' : 'FLEET_OWNER',
            organizationId: token === 'no-org' ? null : 'org-a',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });
  afterEach(async () => app.close());

  it('uses authenticated organization for finance summary', async () => {
    finance.getSummary.mockResolvedValue({ revenue: { total: 1 } });
    await request(app.getHttpServer())
      .get('/api/finance/summary?period=YEARLY')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(finance.getSummary).toHaveBeenCalledWith('org-a', { period: 'YEARLY' });
  });
  it('rejects unauthenticated, driver, and organization-less access', async () => {
    await request(app.getHttpServer()).get('/api/finance/summary').expect(401);
    await request(app.getHttpServer())
      .get('/api/finance/summary')
      .set('Authorization', 'Bearer driver')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/finance/summary')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
  });
  it('validates period ranges and refuses client-supplied organization ids', async () => {
    await request(app.getHttpServer())
      .get('/api/finance/summary?period=DAILY')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/finance/summary?organizationId=org-other')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });
});
