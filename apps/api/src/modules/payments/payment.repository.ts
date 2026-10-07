import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Prisma } from '@prisma/client';
import type { PaymentMethod, PaymentStatus } from '@fleetnexus/shared';

export type PaymentFilters = {
  tripId?: string;
  customerId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
};

const PAYMENT_RELATIONS = {
  trip: {
    select: {
      id: true,
      tripNumber: true,
      actualFreight: true,
      estimatedFreight: true,
    },
  },
  customer: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PaymentCreateInput) {
    return this.prisma.payment.create({ data, include: PAYMENT_RELATIONS });
  }

  findAllByOrganization(organizationId: string, filters: PaymentFilters = {}) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        ...(filters.tripId && { tripId: filters.tripId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.startDate || filters.endDate
          ? {
              paymentDate: {
                ...(filters.startDate && { gte: filters.startDate }),
                ...(filters.endDate && { lte: filters.endDate }),
              },
            }
          : {}),
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      include: PAYMENT_RELATIONS,
    });
  }

  findByIdForOrganization(id: string, organizationId: string) {
    return this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: PAYMENT_RELATIONS,
    });
  }

  findTripForOrganization(id: string, organizationId: string) {
    return this.prisma.trip.findFirst({
      where: { id, organizationId },
      select: { id: true, customerId: true, financialStatus: true },
    });
  }

  reopenReviewForOrganization(id: string, organizationId: string) {
    return this.prisma.trip.updateMany({
      where: { id, organizationId, financialStatus: 'READY_FOR_REVIEW' },
      data: { financialStatus: 'OPEN' },
    });
  }

  findCustomerForOrganization(id: string, organizationId: string) {
    return this.prisma.customer.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
  }

  async updateForOrganization(
    id: string,
    organizationId: string,
    data: Prisma.PaymentUpdateManyMutationInput,
  ) {
    const result = await this.prisma.payment.updateMany({
      where: { id, organizationId },
      data,
    });
    if (!result.count) return null;
    return this.findByIdForOrganization(id, organizationId);
  }
}
