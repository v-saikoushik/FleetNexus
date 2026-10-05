import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Expense, Prisma } from '@prisma/client';

@Injectable()
export class ExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ExpenseCreateInput): Promise<Expense> {
    return this.prisma.expense.create({ data });
  }

  findAllByOrganization(
    organizationId: string,
    filters?: { tripId?: string; vehicleId?: string },
  ): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: {
        organizationId,
        ...(filters?.tripId && { tripId: filters.tripId }),
        ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
      },
      orderBy: { date: 'desc' },
    });
  }

  findByIdForOrganization(id: string, organizationId: string): Promise<Expense | null> {
    return this.prisma.expense.findFirst({ where: { id, organizationId } });
  }
}
