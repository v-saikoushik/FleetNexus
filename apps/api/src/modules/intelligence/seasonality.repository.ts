import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class SeasonalityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCompletedTrips(organizationId: string) {
    return this.prisma.trip.findMany({
      where: { organizationId, status: 'COMPLETED' },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        startDate: true,
        routeId: true,
        commodityId: true,
        customerId: true,
        originName: true,
        destinationName: true,
        actualFreight: true,
        estimatedFreight: true,
        actualDistanceKm: true,
        estimatedDistanceKm: true,
        expenses: { where: { organizationId }, select: { id: true, type: true, amount: true } },
        fuelTransactions: {
          where: { organizationId },
          select: { id: true, litres: true, totalAmount: true },
        },
        payments: { where: { organizationId }, select: { id: true, amount: true, status: true } },
      },
    });
  }

  findUnlinkedExpenses(organizationId: string) {
    return this.prisma.expense.findMany({
      where: { organizationId, tripId: null },
      select: { id: true, type: true, amount: true, date: true, routeId: true },
    });
  }

  findUnlinkedFuelTransactions(organizationId: string) {
    return this.prisma.fuelTransaction.findMany({
      where: { organizationId, tripId: null },
      select: { id: true, totalAmount: true, date: true, vehicleId: true },
    });
  }

  findCommodities(organizationId: string) {
    return this.prisma.commodity.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
  }

  findCustomers(organizationId: string) {
    return this.prisma.customer.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
  }

  findRoutes(organizationId: string) {
    return this.prisma.route.findMany({
      where: { organizationId },
      select: { id: true, originLocationId: true, destinationLocationId: true },
    });
  }

  findLocations(organizationId: string) {
    return this.prisma.location.findMany({
      where: { organizationId },
      select: { id: true, name: true, city: true, state: true },
    });
  }

  findCommodity(organizationId: string, commodityId: string) {
    return this.prisma.commodity.findFirst({
      where: { organizationId, id: commodityId },
      select: { id: true, name: true },
    });
  }

  findCustomer(organizationId: string, customerId: string) {
    return this.prisma.customer.findFirst({
      where: { organizationId, id: customerId },
      select: { id: true, name: true },
    });
  }

  findRoute(organizationId: string, routeId: string) {
    return this.prisma.route.findFirst({
      where: { organizationId, id: routeId },
      select: { id: true, originLocationId: true, destinationLocationId: true },
    });
  }
}
