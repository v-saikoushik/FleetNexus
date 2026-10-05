import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Driver, Prisma } from '@prisma/client';

@Injectable()
export class DriverRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.DriverCreateInput): Promise<Driver> {
    return this.prisma.driver.create({ data });
  }

  findAllByOrganization(
    organizationId: string,
    filters?: { status?: string; search?: string },
  ): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        organizationId,
        ...(filters?.status && { status: filters.status as never }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search, mode: 'insensitive' } },
            { licenseNumber: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });
  }

  findByIdForOrganization(id: string, organizationId: string): Promise<Driver | null> {
    return this.prisma.driver.findFirst({ where: { id, organizationId } });
  }

  update(id: string, organizationId: string, data: Prisma.DriverUpdateInput): Promise<Driver> {
    void organizationId;
    return this.prisma.driver.update({ where: { id }, data });
  }

  /**
   * Completed-trip performance foundation for a driver (no scoring).
   */
  getCompletedTripsForDriver(organizationId: string, driverId: string) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        driverId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        actualDistanceKm: true,
        estimatedDistanceKm: true,
        actualFreight: true,
        estimatedFreight: true,
        expenses: { select: { type: true, amount: true } },
        fuelTransactions: { select: { litres: true, totalAmount: true } },
      },
    });
  }
}
