import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export type FinanceRange = { startDate: Date; endDate: Date };

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCompletedTrips(organizationId: string, range: FinanceRange) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        startDate: { gte: range.startDate, lte: range.endDate },
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        tripNumber: true,
        financialStatus: true,
        startDate: true,
        vehicleId: true,
        customerId: true,
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
          select: {
            id: true,
            date: true,
            vehicleId: true,
            tripId: true,
            litres: true,
            totalAmount: true,
          },
        },
        payments: {
          where: { organizationId },
          select: { id: true, amount: true, status: true },
        },
      },
    });
  }

  findExpensesForPeriod(organizationId: string, range: FinanceRange) {
    return this.prisma.expense.findMany({
      where: { organizationId, date: { gte: range.startDate, lte: range.endDate } },
      orderBy: [{ date: 'desc' }, { amount: 'desc' }],
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        referenceNumber: true,
        tripId: true,
        vehicleId: true,
      },
    });
  }

  findFuelTransactionsForPeriod(organizationId: string, range: FinanceRange) {
    return this.prisma.fuelTransaction.findMany({
      where: { organizationId, date: { gte: range.startDate, lte: range.endDate } },
      select: {
        id: true,
        date: true,
        tripId: true,
        vehicleId: true,
        litres: true,
        totalAmount: true,
      },
    });
  }

  findReceivedPaymentsForPeriod(organizationId: string, range: FinanceRange) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        status: { in: ['PAID', 'PARTIAL'] },
        paymentDate: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        id: true,
        tripId: true,
        customerId: true,
        amount: true,
        status: true,
        paymentDate: true,
      },
    });
  }

  findVehiclesForOrganization(organizationId: string) {
    return this.prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true, registrationNumber: true },
      orderBy: { registrationNumber: 'asc' },
    });
  }

  findCustomersForOrganization(organizationId: string) {
    return this.prisma.customer.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
