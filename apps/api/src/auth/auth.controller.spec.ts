import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUser } from './auth.service';

type ApiBody = {
  success: boolean;
  data?: {
    tokens?: { accessToken: string };
    user?: AuthUser;
    email?: string;
  };
};

describe('AuthController', () => {
  let app: INestApplication<App>;

  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'john@example.com',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    role: 'DRIVER',
    organizationId: null,
    isActive: true,
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getMe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { headers: { authorization?: string }; user?: unknown };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          const auth = req.headers.authorization;
          if (!auth || !auth.startsWith('Bearer ')) {
            throw new UnauthorizedException('Unauthorized');
          }
          req.user = {
            userId: 'user-1',
            email: 'john@example.com',
            role: 'DRIVER',
            organizationId: null,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/auth/register — valid registration', async () => {
    mockAuthService.register.mockResolvedValue({
      user: mockUser,
      tokens: { accessToken: 'token' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
      })
      .expect(201);

    const body = res.body as ApiBody;
    expect(body.success).toBe(true);
    expect(body.data?.tokens?.accessToken).toBe('token');
    expect(body.data?.user).not.toHaveProperty('passwordHash');
  });

  it('POST /api/auth/login — valid login', async () => {
    mockAuthService.login.mockResolvedValue({
      user: mockUser,
      tokens: { accessToken: 'token' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: 'john@example.com', password: 'Password123!' })
      .expect(200);

    const body = res.body as ApiBody;
    expect(body.success).toBe(true);
    expect(body.data?.tokens?.accessToken).toBe('token');
  });

  it('GET /api/auth/me — rejects request without token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/me — returns profile with valid token', async () => {
    mockAuthService.getMe.mockResolvedValue(mockUser);

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    const body = res.body as ApiBody;
    expect(body.success).toBe(true);
    expect(body.data?.email).toBe('john@example.com');
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects a client-supplied privileged role during registration', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'Mallory',
        lastName: 'Admin',
        email: 'mallory@example.com',
        password: 'Password123!',
        role: 'SUPER_ADMIN',
      })
      .expect(400);

    expect(mockAuthService.register).not.toHaveBeenCalled();
  });
});
