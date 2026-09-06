import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Prisma, Trip } from '@prisma/client';

export const TRIP_WITH_RELATIONS = {
  vehicle: { select: { id: true, registrationNumber: true, vehicleType: true } },
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
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
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

  getLatestTripNumber(organizationId: string): Promise<{ tripNumber: string } | null> {
    return this.prisma.trip.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: { tripNumber: true },
    });
  }

  /**
   * Aggregates trip financial data for a vehicle within a date range.
   * Used by the finance reporting service.
   */
  getFinancialAggregateByVehicle(
    organizationId: string,
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        vehicleId,
        startDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
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

  /**
   * Aggregates trip financial data across the fleet within a date range.
   */
  getFinancialAggregateByOrganization(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    vehicleId?: string,
  ) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        ...(vehicleId && { vehicleId }),
        startDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
      select: {
        id: true,
        vehicleId: true,
        actualFreight: true,
        estimatedFreight: true,
        actualDistanceKm: true,
        loadWeightTons: true,
        expenses: { select: { type: true, amount: true } },
        fuelTransactions: { select: { litres: true, totalAmount: true } },
        payments: { select: { amount: true, status: true } },
        vehicle: { select: { registrationNumber: true } },
      },
    });
  }
}
