import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get(JwtService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('/api/auth/me (GET) rejects a missing token', () => {
    return request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('/api/auth/me (GET) rejects an invalid token', () => {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('/api/auth/rbac-check (GET) rejects an unauthenticated request', () => {
    return request(app.getHttpServer()).get('/api/auth/rbac-check').expect(401);
  });

  it('/api/auth/rbac-check (GET) rejects a user without the required role', () => {
    const token = jwtService.sign({
      sub: 'driver-1',
      email: 'driver@example.com',
      role: 'DRIVER',
      organizationId: null,
    });

    return request(app.getHttpServer())
      .get('/api/auth/rbac-check')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('/api/auth/rbac-check (GET) permits a user with the required role', () => {
    const token = jwtService.sign({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      organizationId: null,
    });

    return request(app.getHttpServer())
      .get('/api/auth/rbac-check')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
