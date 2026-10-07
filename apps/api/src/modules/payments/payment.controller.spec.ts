import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const PAYMENT_ID = 'b94160ef-5fc2-4bcc-8f34-4e37c5311e7e';
const TRIP_ID = '783fccd3-5618-4aac-b8c9-759f682b2c21';
const CUSTOMER_ID = '3bf19dbd-69dc-4de6-b09e-c91ed39011ea';

describe('PaymentController', () => {
  let app: INestApplication<App>;
  const payments = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: payments }],
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

  it('creates a payment using the authenticated organization', async () => {
    payments.create.mockResolvedValue({ id: PAYMENT_ID, organizationId: 'org-a' });
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', 'Bearer owner')
      .send({ tripId: TRIP_ID, customerId: CUSTOMER_ID, amount: 250, status: 'PENDING' })
      .expect(201);
    expect(payments.create).toHaveBeenCalledWith('org-a', {
      tripId: TRIP_ID,
      customerId: CUSTOMER_ID,
      amount: 250,
      status: 'PENDING',
    });
  });

  it('lists payments with validated query filters', async () => {
    payments.findAll.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`/api/payments?tripId=${TRIP_ID}&status=PAID&paymentMethod=UPI`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(payments.findAll).toHaveBeenCalledWith('org-a', {
      tripId: TRIP_ID,
      status: 'PAID',
      paymentMethod: 'UPI',
    });
  });

  it('gets one payment by ID', async () => {
    payments.findOne.mockResolvedValue({ id: PAYMENT_ID });
    await request(app.getHttpServer())
      .get(`/api/payments/${PAYMENT_ID}`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(payments.findOne).toHaveBeenCalledWith('org-a', PAYMENT_ID);
  });

  it('updates a payment', async () => {
    payments.update.mockResolvedValue({ id: PAYMENT_ID, amount: 300 });
    await request(app.getHttpServer())
      .patch(`/api/payments/${PAYMENT_ID}`)
      .set('Authorization', 'Bearer owner')
      .send({ amount: 300 })
      .expect(200);
    expect(payments.update).toHaveBeenCalledWith('org-a', PAYMENT_ID, { amount: 300 });
  });

  it.each([
    [{ tripId: TRIP_ID, amount: 0 }],
    [{ tripId: TRIP_ID, amount: 10, status: 'REFUNDED' }],
    [{ tripId: TRIP_ID, amount: 10, paymentMethod: 'CRYPTO' }],
    [{ tripId: TRIP_ID, amount: 10, paymentDate: 'not-a-date' }],
  ])('rejects invalid payment input %#', async (body) => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', 'Bearer owner')
      .send(body)
      .expect(400);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('rejects client-supplied organization IDs', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', 'Bearer owner')
      .send({ tripId: TRIP_ID, amount: 10, organizationId: 'org-b' })
      .expect(400);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/payments').expect(401);
  });

  it('allows drivers to read payments but denies payment management', async () => {
    payments.findAll.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/payments')
      .set('Authorization', 'Bearer driver')
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', 'Bearer driver')
      .send({ tripId: TRIP_ID, amount: 10 })
      .expect(403);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('requires an organization on the authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/api/payments')
      .set('Authorization', 'Bearer no-org')
      .expect(403);
  });
});
