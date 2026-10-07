import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  const repository = {
    create: jest.fn(),
    findAllByOrganization: jest.fn(),
    findByIdForOrganization: jest.fn(),
    findTripForOrganization: jest.fn(),
    findCustomerForOrganization: jest.fn(),
    updateForOrganization: jest.fn(),
    reopenReviewForOrganization: jest.fn(),
  };
  const payment = {
    id: 'payment-a',
    organizationId: 'org-a',
    tripId: 'trip-a',
    customerId: 'customer-a',
    amount: 500,
    status: 'PENDING',
    paymentMethod: null,
    paymentDate: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findTripForOrganization.mockResolvedValue({
      id: 'trip-a',
      customerId: 'customer-a',
    });
    repository.findCustomerForOrganization.mockResolvedValue({ id: 'customer-a' });
    service = new PaymentService(repository as unknown as PaymentRepository);
  });

  it('creates a payment and inherits the trip customer when omitted', async () => {
    repository.create.mockResolvedValue(payment);
    await expect(service.create('org-a', { tripId: 'trip-a', amount: 500 })).resolves.toEqual(
      payment,
    );
    expect(repository.findTripForOrganization).toHaveBeenCalledWith('trip-a', 'org-a');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: { connect: { id: 'org-a' } },
        trip: { connect: { id: 'trip-a' } },
        customer: { connect: { id: 'customer-a' } },
        amount: 500,
      }),
    );
  });

  it('creates a received payment with validated method and date', async () => {
    repository.create.mockResolvedValue({
      ...payment,
      status: 'PAID',
      paymentMethod: 'UPI',
      paymentDate: new Date('2026-06-01T00:00:00.000Z'),
    });
    await service.create('org-a', {
      tripId: 'trip-a',
      amount: 500,
      status: 'PAID',
      paymentMethod: 'UPI',
      paymentDate: '2026-06-01T00:00:00.000Z',
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PAID',
        paymentMethod: 'UPI',
        paymentDate: new Date('2026-06-01T00:00:00.000Z'),
      }),
    );
  });

  it('rejects a missing or cross-organization trip', async () => {
    repository.findTripForOrganization.mockResolvedValue(null);
    await expect(service.create('org-a', { tripId: 'trip-b', amount: 500 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a missing or cross-organization customer', async () => {
    repository.findTripForOrganization.mockResolvedValue({ id: 'trip-a', customerId: null });
    repository.findCustomerForOrganization.mockResolvedValue(null);
    await expect(
      service.create('org-a', { tripId: 'trip-a', customerId: 'customer-b', amount: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a customer that does not match the trip customer', async () => {
    repository.findCustomerForOrganization.mockResolvedValue({ id: 'customer-b' });
    await expect(
      service.create('org-a', { tripId: 'trip-a', customerId: 'customer-b', amount: 500 }),
    ).rejects.toThrow('Customer must match the trip customer');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('requires method and payment date when a payment is marked received', async () => {
    await expect(
      service.create('org-a', { tripId: 'trip-a', amount: 500, status: 'PAID' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists payments within the organization and forwards useful filters', async () => {
    repository.findAllByOrganization.mockResolvedValue([payment]);
    const result = await service.findAll('org-a', {
      tripId: 'trip-a',
      customerId: 'customer-a',
      status: 'PAID',
      paymentMethod: 'UPI',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-30T23:59:59.000Z',
    });
    expect(result).toEqual([payment]);
    expect(repository.findAllByOrganization).toHaveBeenCalledWith('org-a', {
      tripId: 'trip-a',
      customerId: 'customer-a',
      status: 'PAID',
      paymentMethod: 'UPI',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T23:59:59.000Z'),
    });
  });

  it('rejects an inverted payment date range', () => {
    expect(() =>
      service.findAll('org-a', {
        startDate: '2026-06-30T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('gets a payment scoped to the organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(payment);
    await expect(service.findOne('org-a', 'payment-a')).resolves.toEqual(payment);
    expect(repository.findByIdForOrganization).toHaveBeenCalledWith('payment-a', 'org-a');
  });

  it('hides another organization payment and prevents updates through IDOR', async () => {
    repository.findByIdForOrganization.mockResolvedValue(null);
    await expect(service.findOne('org-a', 'payment-b')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('org-a', 'payment-b', { amount: 20 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.updateForOrganization).not.toHaveBeenCalled();
  });

  it('updates a payment with an organization-scoped query', async () => {
    repository.findByIdForOrganization.mockResolvedValue(payment);
    repository.updateForOrganization.mockResolvedValue({ ...payment, amount: 600 });
    await expect(service.update('org-a', 'payment-a', { amount: 600 })).resolves.toMatchObject({
      amount: 600,
    });
    expect(repository.updateForOrganization).toHaveBeenCalledWith('payment-a', 'org-a', {
      amount: 600,
    });
  });

  it('rejects a trip/customer reference from another organization during update', async () => {
    repository.findByIdForOrganization.mockResolvedValue(payment);
    repository.findTripForOrganization.mockResolvedValue(null);
    await expect(service.update('org-a', 'payment-a', { tripId: 'trip-b' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.updateForOrganization).not.toHaveBeenCalled();
  });

  it('rejects adding or changing a payment for finalized trip financials', async () => {
    repository.findTripForOrganization.mockResolvedValue({
      id: 'trip-a',
      customerId: 'customer-a',
      financialStatus: 'FINALIZED',
    });
    await expect(service.create('org-a', { tripId: 'trip-a', amount: 500 })).rejects.toThrow(
      /reopen financials/i,
    );
    repository.findByIdForOrganization.mockResolvedValue(payment);
    await expect(service.update('org-a', 'payment-a', { amount: 600 })).rejects.toThrow(
      /reopen financials/i,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.updateForOrganization).not.toHaveBeenCalled();
  });

  it('invalidates ready financial review after a payment is changed', async () => {
    repository.findByIdForOrganization.mockResolvedValue(payment);
    repository.findTripForOrganization.mockResolvedValue({
      id: 'trip-a',
      customerId: 'customer-a',
      financialStatus: 'READY_FOR_REVIEW',
    });
    repository.updateForOrganization.mockResolvedValue({ ...payment, amount: 600 });
    await service.update('org-a', 'payment-a', { amount: 600 });
    expect(repository.reopenReviewForOrganization).toHaveBeenCalledWith('trip-a', 'org-a');
  });
});
