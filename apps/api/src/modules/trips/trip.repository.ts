import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Prisma, Trip } from '@prisma/client';

export const TRIP_WITH_RELATIONS = {
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      vehicleType: true,
      status: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      licenseNumber: true,
    },
  },
  customer: { select: { id: true, name: true } },
  commodity: { select: { id: true, name: true, category: true } },
  route: { select: { id: true, estimatedDistance: true, tollEstimate: true } },
  expenses: true,
  fuelTransactions: true,
  payments: true,
} as const;

@Injectable()
export class TripRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TripCreateInput): Promise<Trip> {
    return this.prisma.trip.create({ data });
  }

  findAllByOrganization(
    organizationId: string,
    filters?: {
      vehicleId?: string;
      driverId?: string;
      customerId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
        ...(filters?.driverId && { driverId: filters.driverId }),
        ...(filters?.customerId && { customerId: filters.customerId }),
        ...(filters?.status && { status: filters.status as never }),
        ...(filters?.startDate || filters?.endDate
          ? {
              startDate: {
                ...(filters.startDate && { gte: filters.startDate }),
                ...(filters.endDate && { lte: filters.endDate }),
              },
            }
          : {}),
      },
      orderBy: { startDate: 'desc' },
      include: {
        vehicle: { select: { id: true, registrationNumber: true } },
        driver: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        commodity: { select: { id: true, name: true } },
      },
    });
  }

  findByIdForOrganization(id: string, organizationId: string) {
    return this.prisma.trip.findFirst({
      where: { id, organizationId },
      include: TRIP_WITH_RELATIONS,
    });
  }

  update(id: string, organizationId: string, data: Prisma.TripUpdateInput): Promise<Trip> {
    void organizationId;
    return this.prisma.trip.update({ where: { id }, data });
  }

  countByStatus(organizationId: string, status: Prisma.EnumTripStatusFilter['equals']) {
    return this.prisma.trip.count({ where: { organizationId, status } });
  }

  countStartingOnDay(organizationId: string, dayStart: Date, dayEnd: Date) {
    return this.prisma.trip.count({
      where: {
        organizationId,
        startDate: { gte: dayStart, lt: dayEnd },
      },
    });
  }

  getFinancialAggregateByVehicle(
    organizationId: string,
    vehicleId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        vehicleId,
        status: 'COMPLETED',
        ...(startDate || endDate
          ? {
              startDate: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
            }
          : {}),
      },
      select: {
        id: true,
        actualFreight: true,
        estimatedFreight: true,
        actualDistanceKm: true,
        estimatedDistanceKm: true,
        loadWeightTons: true,
        expenses: { select: { type: true, amount: true } },
        fuelTransactions: { select: { litres: true, totalAmount: true } },
        payments: { select: { amount: true, status: true } },
      },
    });
  }

  getFinancialAggregateByOrganization(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
    vehicleId?: string,
  ) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        ...(vehicleId && { vehicleId }),
        status: 'COMPLETED',
        ...(startDate || endDate
          ? {
              startDate: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
            }
          : {}),
      },
      select: {
        id: true,
        vehicleId: true,
        actualFreight: true,
        estimatedFreight: true,
        actualDistanceKm: true,
        estimatedDistanceKm: true,
        loadWeightTons: true,
        expenses: { select: { type: true, amount: true } },
        fuelTransactions: { select: { litres: true, totalAmount: true } },
        payments: { select: { amount: true, status: true } },
        vehicle: { select: { registrationNumber: true } },
      },
    });
  }
}
