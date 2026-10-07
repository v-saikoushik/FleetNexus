import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SeasonalityController } from './seasonality.controller';
import { SeasonalityService } from './seasonality.service';

const commodityId = 'b4969fbd-3452-413a-84b0-20c064e5016b';
const routeId = '84d2e707-64bb-4b7b-b25c-9e872bef68bb';
const customerId = '22c64b18-34fc-469f-8cc4-8c729e8ecb96';

describe('SeasonalityController', () => {
  let app: INestApplication<App>;
  const seasonality = {
    getOverview: jest.fn(),
    getCommodities: jest.fn(),
    getRoutes: jest.fn(),
    getCommodity: jest.fn(),
    getRoute: jest.fn(),
    getRouteCommodities: jest.fn(),
    getCustomer: jest.fn(),
    compare: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    for (const method of Object.values(seasonality)) method.mockResolvedValue({ data: [] });
    const module = await Test.createTestingModule({
      controllers: [SeasonalityController],
      providers: [{ provide: SeasonalityService, useValue: seasonality }],
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

  it('serves all seasonality endpoints with authenticated organization scope', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview?year=2025&startMonth=1&endMonth=3')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/commodities')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/routes')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/seasonality/commodities/${commodityId}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/seasonality/routes/${routeId}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/seasonality/routes/${routeId}/commodities?commodityId=${commodityId}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/seasonality/customers/${customerId}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(
        `/api/intelligence/seasonality/compare?entityType=commodity&commodityId=${commodityId}&metric=tripCount`,
      )
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(seasonality.getOverview).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ year: 2025, startMonth: 1, endMonth: 3 }),
    );
    expect(seasonality.getCommodity).toHaveBeenCalledWith('org-a', commodityId, expect.any(Object));
    expect(seasonality.getRoute).toHaveBeenCalledWith('org-a', routeId, expect.any(Object));
    expect(seasonality.getRouteCommodities).toHaveBeenCalledWith(
      'org-a',
      routeId,
      expect.objectContaining({ commodityId }),
    );
    expect(seasonality.getCustomer).toHaveBeenCalledWith('org-a', customerId, expect.any(Object));
    expect(seasonality.compare).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ entityType: 'commodity', commodityId, metric: 'tripCount' }),
    );
  });

  it('rejects unauthenticated, unauthorized, organization-less, and client-scoped requests', async () => {
    await request(app.getHttpServer()).get('/api/intelligence/seasonality/overview').expect(401);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview')
      .set('Authorization', 'Bearer driver')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview?organizationId=org-b')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });

  it('validates IDs, filters, and comparison query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/commodities/not-a-uuid')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview?startMonth=13')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/overview?unexpected=yes')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/intelligence/seasonality/compare?entityType=commodity&metric=forecast')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get(
        '/api/intelligence/seasonality/compare?entityType=routeCommodity&metric=tripCount&commodityId=bad&routeId=bad',
      )
      .set('Authorization', 'Bearer owner')
      .expect(400);
    seasonality.getCommodity.mockRejectedValueOnce(new NotFoundException('Commodity not found'));
    await request(app.getHttpServer())
      .get(`/api/intelligence/seasonality/commodities/${commodityId}`)
      .set('Authorization', 'Bearer owner')
      .expect(404);
  });
});
