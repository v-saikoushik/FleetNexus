import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Expense, Prisma } from '@prisma/client';

export type ExpenseFilters = {
  tripId?: string;
  vehicleId?: string;
  driverId?: string;
  type?: Prisma.EnumExpenseTypeFilter['equals'];
  startDate?: Date;
  endDate?: Date;
};

@Injectable()
export class ExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ExpenseCreateInput): Promise<Expense> {
    return this.prisma.expense.create({ data });
  }

  findAllByOrganization(organizationId: string, filters?: ExpenseFilters): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: {
        organizationId,
        ...(filters?.tripId && { tripId: filters.tripId }),
        ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
        ...(filters?.driverId && { driverId: filters.driverId }),
        ...(filters?.type && { type: filters.type }),
        ...(filters?.startDate || filters?.endDate
          ? {
              date: {
                ...(filters.startDate && { gte: filters.startDate }),
                ...(filters.endDate && { lte: filters.endDate }),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        trip: { select: { id: true, tripNumber: true, driverId: true, financialStatus: true } },
        vehicle: { select: { id: true, registrationNumber: true } },
        driver: { select: { id: true, name: true } },
      },
    });
  }

  findByIdForOrganization(id: string, organizationId: string) {
    return this.prisma.expense.findFirst({
      where: { id, organizationId },
      include: {
        trip: { select: { id: true, tripNumber: true, driverId: true, financialStatus: true } },
        vehicle: { select: { id: true, registrationNumber: true } },
        driver: { select: { id: true, name: true } },
      },
    });
  }

  findTripForOrganization(id: string, organizationId: string) {
    return this.prisma.trip.findFirst({
      where: { id, organizationId },
      select: { id: true, financialStatus: true },
    });
  }

  reopenReviewForOrganization(id: string, organizationId: string) {
    return this.prisma.trip.updateMany({
      where: { id, organizationId, financialStatus: 'READY_FOR_REVIEW' },
      data: { financialStatus: 'OPEN' },
    });
  }

  findVehicleForOrganization(id: string, organizationId: string) {
    return this.prisma.vehicle.findFirst({ where: { id, organizationId }, select: { id: true } });
  }

  findDriverForOrganization(id: string, organizationId: string) {
    return this.prisma.driver.findFirst({ where: { id, organizationId }, select: { id: true } });
  }

  findRouteForOrganization(id: string, organizationId: string) {
    return this.prisma.route.findFirst({ where: { id, organizationId }, select: { id: true } });
  }

  async updateForOrganization(
    id: string,
    organizationId: string,
    data: Prisma.ExpenseUpdateManyMutationInput,
  ) {
    const result = await this.prisma.expense.updateMany({
      where: { id, organizationId },
      data,
    });
    if (!result.count) return null;
    return this.findByIdForOrganization(id, organizationId);
  }
}
