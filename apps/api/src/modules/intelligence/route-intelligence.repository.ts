import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class RouteIntelligenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRoutes(organizationId: string) {
    return this.prisma.route.findMany({
      where: { organizationId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        estimatedDistance: true,
        originLocationId: true,
        destinationLocationId: true,
      },
    });
  }

  findRoute(organizationId: string, routeId: string) {
    return this.prisma.route.findFirst({
      where: { organizationId, id: routeId },
      select: {
        id: true,
        estimatedDistance: true,
        originLocationId: true,
        destinationLocationId: true,
      },
    });
  }

  findCompletedTrips(organizationId: string, routeId?: string) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        ...(routeId ? { routeId } : { routeId: { not: null } }),
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        routeId: true,
        vehicleId: true,
        customerId: true,
        commodityId: true,
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

  findLocations(organizationId: string) {
    return this.prisma.location.findMany({
      where: { organizationId },
      select: { id: true, name: true, city: true, state: true },
    });
  }

  findVehicles(organizationId: string) {
    return this.prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true, registrationNumber: true },
    });
  }

  findCustomers(organizationId: string) {
    return this.prisma.customer.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
  }

  findCommodities(organizationId: string) {
    return this.prisma.commodity.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
  }

  findUnlinkedRouteExpenses(organizationId: string, routeId?: string) {
    return this.prisma.expense.findMany({
      where: { organizationId, tripId: null, routeId: routeId ?? { not: null } },
      select: { id: true, type: true, amount: true, routeId: true },
    });
  }
}
