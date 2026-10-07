import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { FinanceRange } from '@/modules/finance/finance.repository';

@Injectable()
export class CostIntelligenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCompletedTripCosts(organizationId: string, range?: FinanceRange) {
    return this.prisma.trip.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        ...(range ? { startDate: { gte: range.startDate, lte: range.endDate } } : {}),
      },
      select: {
        id: true,
        vehicleId: true,
        customerId: true,
        routeId: true,
        originName: true,
        destinationName: true,
        expenses: {
          where: { organizationId },
          select: { id: true, type: true, amount: true },
        },
        fuelTransactions: {
          where: { organizationId },
          select: { id: true, totalAmount: true },
        },
      },
    });
  }

  findExpensesForPeriod(organizationId: string, range: FinanceRange) {
    return this.prisma.expense.findMany({
      where: { organizationId, date: { gte: range.startDate, lte: range.endDate } },
      select: { id: true, type: true, amount: true, tripId: true, vehicleId: true },
    });
  }

  findFuelForPeriod(organizationId: string, range: FinanceRange) {
    return this.prisma.fuelTransaction.findMany({
      where: { organizationId, date: { gte: range.startDate, lte: range.endDate } },
      select: { id: true, totalAmount: true, tripId: true, vehicleId: true },
    });
  }
}
