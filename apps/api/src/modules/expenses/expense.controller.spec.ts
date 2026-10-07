import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

const EXPENSE_ID = '387fb15d-934c-4df1-87a0-8de090c94713';
const TRIP_ID = '783fccd3-5618-4aac-b8c9-759f682b2c21';

describe('ExpenseController', () => {
  let app: INestApplication<App>;
  const expenses = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseController],
      providers: [{ provide: ExpenseService, useValue: expenses }],
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
          if (!token) throw new UnauthorizedException('Unauthorized');
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
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => app.close());

  it('creates an expense using the authenticated organization', async () => {
    expenses.create.mockResolvedValue({ id: EXPENSE_ID, organizationId: 'org-a' });
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', 'Bearer owner')
      .send({ type: 'TOLL', amount: 25, tripId: TRIP_ID })
      .expect(201);
    expect(expenses.create).toHaveBeenCalledWith('org-a', {
      type: 'TOLL',
      amount: 25,
      tripId: TRIP_ID,
    });
  });

  it('lists expenses with validated query filters', async () => {
    expenses.findAll.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/expenses?type=TOLL&tripId=' + TRIP_ID)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(expenses.findAll).toHaveBeenCalledWith('org-a', { type: 'TOLL', tripId: TRIP_ID });
  });

  it('gets one expense by ID', async () => {
    expenses.findOne.mockResolvedValue({ id: EXPENSE_ID });
    await request(app.getHttpServer())
      .get(`/api/expenses/${EXPENSE_ID}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(expenses.findOne).toHaveBeenCalledWith('org-a', EXPENSE_ID);
  });

  it('updates an expense', async () => {
    expenses.update.mockResolvedValue({ id: EXPENSE_ID, amount: 30 });
    await request(app.getHttpServer())
      .patch(`/api/expenses/${EXPENSE_ID}`)
      .set('Authorization', 'Bearer owner')
      .send({ amount: 30 })
      .expect(200);
    expect(expenses.update).toHaveBeenCalledWith('org-a', EXPENSE_ID, { amount: 30 });
  });

  it.each([
    [{ type: 'TOLL', amount: 0 }],
    [{ type: 'NOT_AN_EXPENSE', amount: 10 }],
    [{ type: 'TOLL', amount: 10, date: 'yesterday' }],
  ])('rejects invalid expense input %#', async (body) => {
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', 'Bearer owner')
      .send(body)
      .expect(400);
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('rejects client-supplied organization IDs', async () => {
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', 'Bearer owner')
      .send({ type: 'TOLL', amount: 10, organizationId: 'org-b' })
      .expect(400);
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/expenses').expect(401);
  });

  it('allows drivers to read expenses but denies expense management', async () => {
    expenses.findAll.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', 'Bearer driver')
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', 'Bearer driver')
      .send({ type: 'TOLL', amount: 10 })
      .expect(403);
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('requires an organization on the authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
  });
});
