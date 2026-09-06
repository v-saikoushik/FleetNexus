import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Prisma, Vehicle } from '@prisma/client';

@Injectable()
export class VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VehicleCreateInput): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data });
  }

  findAllByOrganization(organizationId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { organizationId },
      orderBy: { registrationNumber: 'asc' },
    });
  }

  findByIdForOrganization(id: string, organizationId: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({ where: { id, organizationId } });
  }

  update(id: string, organizationId: string, data: Prisma.VehicleUpdateInput): Promise<Vehicle> {
    void organizationId;
    return this.prisma.vehicle.update({ where: { id }, data });
  }
}
