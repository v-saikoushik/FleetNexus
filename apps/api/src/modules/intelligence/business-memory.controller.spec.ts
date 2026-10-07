import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { BusinessMemoryController } from './business-memory.controller';
import { BusinessMemoryService } from './business-memory.service';
import { HistoricalIntelligenceController } from './historical-intelligence.controller';

describe('BusinessMemoryController', () => {
  let app: INestApplication<App>;
  const memory = {
    getOverview: jest.fn(),
    getSimilarTrips: jest.fn(),
    getSimilarTripsByCriteria: jest.fn(),
    getCustomerHistory: jest.fn(),
    getRouteHistory: jest.fn(),
    getCommodityHistory: jest.fn(),
    getVehicleHistory: jest.fn(),
    getFreightHistory: jest.fn(),
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BusinessMemoryController, HistoricalIntelligenceController],
      providers: [{ provide: BusinessMemoryService, useValue: memory }],
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

  it('serves scoped memory and similar-trip reports', async () => {
    memory.getOverview.mockResolvedValue({ sampleSize: 0 });
    memory.getSimilarTrips.mockResolvedValue({ sampleSize: 0 });
    await request(app.getHttpServer())
      .get('/api/intelligence/memory/overview')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(
        '/api/intelligence/memory/similar-trips?tripId=84d2e707-64bb-4b7b-b25c-9e872bef68bb&limit=5',
      )
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(memory.getOverview).toHaveBeenCalledWith('org-a');
    expect(memory.getSimilarTrips).toHaveBeenCalledWith(
      'org-a',
      '84d2e707-64bb-4b7b-b25c-9e872bef68bb',
      5,
    );
  });

  it('rejects unauthenticated, unauthorized, organization-less, and client-scoped requests', async () => {
    await request(app.getHttpServer()).get('/api/intelligence/memory/overview').expect(401);
    await request(app.getHttpServer())
      .get('/api/intelligence/memory/overview')
      .set('Authorization', 'Bearer driver')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/memory/overview')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/memory/overview?organizationId=org-other')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });

  it('validates the similar-trip query', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/memory/similar-trips?tripId=invalid')
      .set('Authorization', 'Bearer owner')
      .expect(400);
  });

  it('exposes scoped entity and freight history APIs plus field-based similar trips', async () => {
    const id = '84d2e707-64bb-4b7b-b25c-9e872bef68bb';
    for (const url of [
      `/api/intelligence/customers/${id}/history`,
      `/api/intelligence/routes/${id}/history`,
      `/api/intelligence/commodities/${id}/history`,
      `/api/intelligence/vehicles/${id}/history`,
    ])
      await request(app.getHttpServer()).get(url).set('Authorization', 'Bearer owner').expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/freight-rates/history?routeId=${id}&commodityId=${id}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/intelligence/similar-trips?customerId=${id}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(memory.getCustomerHistory).toHaveBeenCalledWith('org-a', id);
    expect(memory.getRouteHistory).toHaveBeenCalledWith('org-a', id);
    expect(memory.getCommodityHistory).toHaveBeenCalledWith('org-a', id);
    expect(memory.getVehicleHistory).toHaveBeenCalledWith('org-a', id);
    expect(memory.getFreightHistory).toHaveBeenCalledWith('org-a', id, id, undefined);
    expect(memory.getSimilarTripsByCriteria).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ customerId: id }),
    );
  });
});
