import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentMethod, PaymentStatus } from '@fleetnexus/shared';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { FilterPaymentsDto } from './dto/filter-payments.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentRepository } from './payment.repository';

@Injectable()
export class PaymentService {
  constructor(private readonly payments: PaymentRepository) {}

  async create(organizationId: string, dto: CreatePaymentDto) {
    const trip = await this.requireTrip(organizationId, dto.tripId);
    const customerId = dto.customerId ?? trip.customerId;
    await this.validateCustomer(organizationId, customerId);
    this.validateTripCustomer(trip.customerId, customerId);
    this.validateCollectionDetails(dto.status ?? 'PENDING', dto.paymentMethod, dto.paymentDate);

    const created = await this.payments.create({
      organization: { connect: { id: organizationId } },
      trip: { connect: { id: trip.id } },
      ...(customerId && { customer: { connect: { id: customerId } } }),
      amount: dto.amount,
      status: dto.status,
      paymentMethod: dto.paymentMethod,
      ...(dto.paymentDate && { paymentDate: new Date(dto.paymentDate) }),
      ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber.trim() }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    await this.invalidateReview(organizationId, trip.id);
    return created;
  }

  findAll(organizationId: string, filters: FilterPaymentsDto = {}) {
    this.validateDateRange(filters.startDate, filters.endDate);
    return this.payments.findAllByOrganization(organizationId, {
      tripId: filters.tripId,
      customerId: filters.customerId,
      status: filters.status,
      paymentMethod: filters.paymentMethod,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.payments.findByIdForOrganization(id, organizationId);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async update(organizationId: string, id: string, dto: UpdatePaymentDto) {
    const existing = await this.findOne(organizationId, id);
    if (dto.tripId === null) throw new BadRequestException('tripId cannot be null');
    if (dto.status === null) throw new BadRequestException('status cannot be null');
    if (dto.amount !== undefined && (typeof dto.amount !== 'number' || dto.amount <= 0)) {
      throw new BadRequestException('amount must be greater than zero');
    }

    const tripId = dto.tripId ?? existing.tripId;
    const previousTrip = await this.requireTrip(organizationId, existing.tripId);
    const trip = await this.requireTrip(organizationId, tripId);
    const customerId =
      dto.customerId !== undefined
        ? dto.customerId
        : dto.tripId
          ? (trip.customerId ?? existing.customerId)
          : existing.customerId;
    await this.validateCustomer(organizationId, customerId);
    this.validateTripCustomer(trip.customerId, customerId);

    const nextStatus = dto.status ?? existing.status;
    if (nextStatus === 'PAID' || nextStatus === 'PARTIAL') {
      const metadataChanged =
        dto.status !== undefined ||
        dto.paymentMethod !== undefined ||
        dto.paymentDate !== undefined;
      if (metadataChanged) {
        this.validateCollectionDetails(
          nextStatus,
          dto.paymentMethod !== undefined ? dto.paymentMethod : existing.paymentMethod,
          dto.paymentDate !== undefined ? dto.paymentDate : existing.paymentDate,
        );
      }
    }

    const updated = await this.payments.updateForOrganization(id, organizationId, {
      ...(dto.tripId !== undefined && { tripId: dto.tripId }),
      ...(dto.customerId !== undefined || (dto.tripId && trip.customerId) ? { customerId } : {}),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
      ...(dto.paymentDate !== undefined && {
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
      }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      ...(dto.referenceNumber !== undefined && {
        referenceNumber: dto.referenceNumber ? dto.referenceNumber.trim() : null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    if (!updated) throw new NotFoundException('Payment not found');
    await this.invalidateReview(organizationId, previousTrip.id);
    if (trip.id !== previousTrip.id) await this.invalidateReview(organizationId, trip.id);
    return updated;
  }

  private async requireTrip(organizationId: string, tripId: string) {
    const trip = await this.payments.findTripForOrganization(tripId, organizationId);
    if (!trip) throw new BadRequestException('Trip not found in your organization');
    if (trip.financialStatus === 'FINALIZED') {
      throw new ConflictException(
        'Trip financials are finalized. Reopen financials before editing payments.',
      );
    }
    return trip;
  }

  private async invalidateReview(organizationId: string, tripId: string) {
    await this.payments.reopenReviewForOrganization(tripId, organizationId);
  }

  private async validateCustomer(organizationId: string, customerId?: string | null) {
    if (!customerId) return;
    const customer = await this.payments.findCustomerForOrganization(customerId, organizationId);
    if (!customer) throw new BadRequestException('Customer not found in your organization');
  }

  private validateTripCustomer(tripCustomerId: string | null, paymentCustomerId?: string | null) {
    if (tripCustomerId && paymentCustomerId !== tripCustomerId) {
      throw new BadRequestException('Customer must match the trip customer');
    }
  }

  private validateCollectionDetails(
    status: PaymentStatus,
    method?: PaymentMethod | null,
    paymentDate?: string | Date | null,
  ) {
    if ((status === 'PAID' || status === 'PARTIAL') && (!method || !paymentDate)) {
      throw new BadRequestException('PAID and PARTIAL payments require a method and payment date');
    }
  }

  private validateDateRange(startDate?: string, endDate?: string) {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate cannot be after endDate');
    }
  }
}
