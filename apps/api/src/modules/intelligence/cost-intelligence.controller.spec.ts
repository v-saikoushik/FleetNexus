import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CostIntelligenceController } from './cost-intelligence.controller';
import { CostIntelligenceService } from './cost-intelligence.service';

describe('CostIntelligenceController', () => {
  let app: INestApplication<App>;
  const intelligence = {
    getSummary: jest.fn(),
    getExpenses: jest.fn(),
    getVehicles: jest.fn(),
    getCustomers: jest.fn(),
    getRoutes: jest.fn(),
    getInsights: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [CostIntelligenceController],
      providers: [{ provide: CostIntelligenceService, useValue: intelligence }],
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

  it('serves the six organization-scoped cost reports', async () => {
    for (const path of ['summary', 'expenses', 'vehicles', 'customers', 'routes', 'insights']) {
      await request(app.getHttpServer())
        .get(`/api/intelligence/costs/${path}`)
        .set('Authorization', 'Bearer owner')
        .expect(200);
    }
    expect(intelligence.getSummary).toHaveBeenCalledWith('org-a', expect.any(Object));
    expect(intelligence.getExpenses).toHaveBeenCalledWith('org-a', expect.any(Object));
    expect(intelligence.getVehicles).toHaveBeenCalledWith('org-a', expect.any(Object));
    expect(intelligence.getCustomers).toHaveBeenCalledWith('org-a');
    expect(intelligence.getRoutes).toHaveBeenCalledWith('org-a');
    expect(intelligence.getInsights).toHaveBeenCalledWith('org-a', expect.any(Object));
  });

  it('rejects unauthenticated, driver, organization-less and client-scoped requests', async () => {
    await request(app.getHttpServer()).get('/api/intelligence/costs/summary').expect(401);
    await request(app.getHttpServer())
      .get('/api/intelligence/costs/summary')
      .set('Authorization', 'Bearer driver')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/costs/summary')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/costs/summary?organizationId=org-other')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });

  it('validates period filters', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/costs/summary?period=DAILY')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });
});
