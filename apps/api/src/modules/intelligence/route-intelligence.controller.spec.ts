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
import { RouteIntelligenceController } from './route-intelligence.controller';
import { RouteIntelligenceService } from './route-intelligence.service';

describe('RouteIntelligenceController', () => {
  let app: INestApplication<App>;
  const intelligence = {
    getRoutes: jest.fn(),
    getAnalysis: jest.fn(),
    getDimension: jest.fn(),
    getExpenses: jest.fn(),
    compare: jest.fn(),
    getInsights: jest.fn(),
  };
  const routeId = '84d2e707-64bb-4b7b-b25c-9e872bef68bb';

  beforeEach(async () => {
    jest.resetAllMocks();
    intelligence.getRoutes.mockResolvedValue({ data: [] });
    intelligence.getAnalysis.mockResolvedValue({ sampleSize: 0 });
    intelligence.getDimension.mockResolvedValue({ data: [] });
    intelligence.getExpenses.mockResolvedValue({ data: [] });
    intelligence.compare.mockResolvedValue({ routes: [] });
    intelligence.getInsights.mockResolvedValue({ data: [] });
    const module = await Test.createTestingModule({
      controllers: [RouteIntelligenceController],
      providers: [{ provide: RouteIntelligenceService, useValue: intelligence }],
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

  it('exposes the route list, analysis dimensions, expenses, comparison, and insights', async () => {
    for (const url of [
      '/api/intelligence/routes',
      '/api/intelligence/routes/compare?metric=averageMargin',
      '/api/intelligence/routes/insights',
      `/api/intelligence/routes/${routeId}/analysis`,
      `/api/intelligence/routes/${routeId}/vehicles`,
      `/api/intelligence/routes/${routeId}/commodities`,
      `/api/intelligence/routes/${routeId}/customers`,
      `/api/intelligence/routes/${routeId}/expenses`,
    ])
      await request(app.getHttpServer()).get(url).set('Authorization', 'Bearer owner').expect(200);
    expect(intelligence.getRoutes).toHaveBeenCalledWith('org-a');
    expect(intelligence.getAnalysis).toHaveBeenCalledWith('org-a', routeId);
    expect(intelligence.getDimension).toHaveBeenCalledWith('org-a', routeId, 'vehicles');
    expect(intelligence.getDimension).toHaveBeenCalledWith('org-a', routeId, 'commodities');
    expect(intelligence.getDimension).toHaveBeenCalledWith('org-a', routeId, 'customers');
    expect(intelligence.getExpenses).toHaveBeenCalledWith('org-a', routeId);
    expect(intelligence.compare).toHaveBeenCalledWith('org-a', 'averageMargin');
    expect(intelligence.getInsights).toHaveBeenCalledWith('org-a');
  });

  it('rejects unauthenticated, unauthorized, organization-less, and client-scoped requests', async () => {
    await request(app.getHttpServer())
      .get(`/api/intelligence/routes/${routeId}/analysis`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/intelligence/routes/${routeId}/analysis`)
      .set('Authorization', 'Bearer driver')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/intelligence/routes/${routeId}/analysis`)
      .set('Authorization', 'Bearer no-org')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/intelligence/routes/${routeId}/analysis?organizationId=org-other`)
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });

  it('validates route IDs and comparison metrics, and maps cross-organization routes to not found', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/routes/not-a-uuid/analysis')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/intelligence/routes/compare?metric=forecast')
      .set('Authorization', 'Bearer owner')
      .expect(400);
    intelligence.getAnalysis.mockRejectedValueOnce(new NotFoundException('Route not found'));
    await request(app.getHttpServer())
      .get(`/api/intelligence/routes/${routeId}/analysis`)
      .set('Authorization', 'Bearer owner')
      .expect(404);
  });
});
