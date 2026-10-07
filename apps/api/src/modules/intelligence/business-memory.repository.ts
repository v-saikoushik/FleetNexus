import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class BusinessMemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCompletedTrips(organizationId: string) {
    return this.prisma.trip.findMany({
      where: { organizationId, status: 'COMPLETED' },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        tripNumber: true,
        startDate: true,
        vehicleId: true,
        routeId: true,
        customerId: true,
        commodityId: true,
        originName: true,
        destinationName: true,
        actualFreight: true,
        estimatedFreight: true,
        actualDistanceKm: true,
        estimatedDistanceKm: true,
        loadWeightTons: true,
        expenses: {
          where: { organizationId },
          select: { id: true, type: true, amount: true },
        },
        fuelTransactions: {
          where: { organizationId },
          select: { id: true, litres: true, totalAmount: true },
        },
        payments: {
          where: { organizationId },
          select: { id: true, amount: true, status: true },
        },
      },
    });
  }

  findVehicles(organizationId: string) {
    return this.prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true, registrationNumber: true, vehicleType: true, capacityTons: true },
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

  findFreightRates(organizationId: string) {
    return this.prisma.freightRate.findMany({
      where: { organizationId },
      orderBy: { effectiveDate: 'desc' },
      select: {
        id: true,
        routeId: true,
        commodityId: true,
        vehicleType: true,
        freightAmount: true,
        rateBasis: true,
        effectiveDate: true,
      },
    });
  }

  findTripById(organizationId: string, tripId: string) {
    return this.prisma.trip.findFirst({
      where: { id: tripId, organizationId, status: 'COMPLETED' },
      select: { id: true, routeId: true, customerId: true, commodityId: true, vehicleId: true },
    });
  }

  findCustomerForOrganization(organizationId: string, customerId: string) {
    return this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true, name: true },
    });
  }

  findRouteForOrganization(organizationId: string, routeId: string) {
    return this.prisma.route.findFirst({
      where: { id: routeId, organizationId },
      select: {
        id: true,
        originLocationId: true,
        destinationLocationId: true,
        estimatedDistance: true,
      },
    });
  }

  findCommodityForOrganization(organizationId: string, commodityId: string) {
    return this.prisma.commodity.findFirst({
      where: { id: commodityId, organizationId },
      select: { id: true, name: true },
    });
  }

  findVehicleForOrganization(organizationId: string, vehicleId: string) {
    return this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { id: true, registrationNumber: true, vehicleType: true, capacityTons: true },
    });
  }
}
