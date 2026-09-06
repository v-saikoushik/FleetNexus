import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Customer, Prisma } from '@prisma/client';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  findAllByOrganization(organizationId: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  findByIdForOrganization(id: string, organizationId: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, organizationId } });
  }

  update(id: string, organizationId: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    void organizationId;
    return this.prisma.customer.update({ where: { id }, data });
  }
}
