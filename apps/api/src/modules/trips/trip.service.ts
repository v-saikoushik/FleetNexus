import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { TripRepository } from './trip.repository';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripService {
  constructor(
    private readonly trips: TripRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(organizationId: string, dto: CreateTripDto) {
    // Validate vehicle belongs to this organization
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, organizationId },
    });
    if (!vehicle) {
      throw new ForbiddenException('Vehicle not found in your organization');
    }

    // Validate optional foreign keys belong to this organization
    if (dto.routeId) {
      const route = await this.prisma.route.findFirst({
        where: { id: dto.routeId, organizationId },
      });
      if (!route) throw new BadRequestException('Route not found in your organization');
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId },
      });
      if (!customer) throw new BadRequestException('Customer not found in your organization');
    }

    if (dto.commodityId) {
      const commodity = await this.prisma.commodity.findFirst({
        where: { id: dto.commodityId, organizationId },
      });
      if (!commodity) throw new BadRequestException('Commodity not found in your organization');
    }

    const tripNumber = await this.generateTripNumber(organizationId);

    return this.trips.create({
      organization: { connect: { id: organizationId } },
      vehicle: { connect: { id: dto.vehicleId } },
      ...(dto.routeId && { route: { connect: { id: dto.routeId } } }),
      ...(dto.customerId && { customer: { connect: { id: dto.customerId } } }),
      ...(dto.commodityId && { commodity: { connect: { id: dto.commodityId } } }),
      tripNumber,
      status: dto.status ?? 'PLANNED',
      startDate: new Date(dto.startDate),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      originName: dto.originName,
      destinationName: dto.destinationName,
      estimatedDistanceKm: dto.estimatedDistanceKm,
      actualDistanceKm: dto.actualDistanceKm,
      loadWeightTons: dto.loadWeightTons,
      estimatedFreight: dto.estimatedFreight,
      actualFreight: dto.actualFreight,
      driverName: dto.driverName,
      driverUserId: dto.driverUserId,
      notes: dto.notes,
    });
  }

  findAll(
    organizationId: string,
    filters?: { vehicleId?: string; status?: string; startDate?: Date; endDate?: Date },
  ) {
    return this.trips.findAllByOrganization(organizationId, filters);
  }

  async findOne(organizationId: string, id: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async update(organizationId: string, id: string, dto: UpdateTripDto) {
    const existing = await this.findOne(organizationId, id);

    // Prevent updating a cancelled trip
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled trip');
    }

    // Validate new vehicle if provided
    if (dto.vehicleId && dto.vehicleId !== existing.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, organizationId },
      });
      if (!vehicle) throw new ForbiddenException('Vehicle not found in your organization');
    }

    return this.trips.update(id, organizationId, {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      ...(dto.originName !== undefined && { originName: dto.originName }),
      ...(dto.destinationName !== undefined && { destinationName: dto.destinationName }),
      ...(dto.estimatedDistanceKm !== undefined && {
        estimatedDistanceKm: dto.estimatedDistanceKm,
      }),
      ...(dto.actualDistanceKm !== undefined && { actualDistanceKm: dto.actualDistanceKm }),
      ...(dto.loadWeightTons !== undefined && { loadWeightTons: dto.loadWeightTons }),
      ...(dto.estimatedFreight !== undefined && { estimatedFreight: dto.estimatedFreight }),
      ...(dto.actualFreight !== undefined && { actualFreight: dto.actualFreight }),
      ...(dto.driverName !== undefined && { driverName: dto.driverName }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
  }

  async complete(organizationId: string, id: string) {
    const trip = await this.findOne(organizationId, id);
    if (trip.status === 'COMPLETED') return trip;
    if (trip.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled trip');
    }

    return this.trips.update(id, organizationId, {
      status: 'COMPLETED',
      endDate: trip.endDate ?? new Date(),
    });
  }

  /**
   * Generates a sequential trip number like TRP-2026-0001.
   * Safe for concurrent use at low volume; for high volume a DB sequence would be preferable.
   */
  private async generateTripNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.trip.count({ where: { organizationId } });
    const seq = String(count + 1).padStart(4, '0');
    return `TRP-${year}-${seq}`;
  }
}
