import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TripStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { ProfitabilityUtil } from '@/modules/intelligence/profitability/profitability.util';
import { TripRepository } from './trip.repository';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';

const ALLOWED_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  PLANNED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'PLANNED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class TripService {
  constructor(
    private readonly trips: TripRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(organizationId: string, dto: CreateTripDto) {
    const vehicle = await this.validateVehicle(organizationId, dto.vehicleId);
    const driver = dto.driverId
      ? await this.validateDriverForAssignment(organizationId, dto.driverId)
      : null;

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

    this.validateFreightAndDates(dto);

    let status: TripStatus = dto.status ?? 'PLANNED';
    if (!dto.status && driver) {
      status = 'ASSIGNED';
    }
    if (status === 'ASSIGNED' && !driver && !dto.driverName) {
      throw new BadRequestException('ASSIGNED trips require a driver');
    }

    const tripNumber = await this.generateTripNumber(organizationId);
    const driverName = driver?.name ?? dto.driverName;

    return this.trips.create({
      organization: { connect: { id: organizationId } },
      vehicle: { connect: { id: vehicle.id } },
      ...(driver && { driver: { connect: { id: driver.id } } }),
      ...(dto.routeId && { route: { connect: { id: dto.routeId } } }),
      ...(dto.customerId && { customer: { connect: { id: dto.customerId } } }),
      ...(dto.commodityId && { commodity: { connect: { id: dto.commodityId } } }),
      tripNumber,
      status,
      startDate: new Date(dto.startDate),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      originName: dto.originName.trim(),
      destinationName: dto.destinationName.trim(),
      estimatedDistanceKm: dto.estimatedDistanceKm,
      actualDistanceKm: dto.actualDistanceKm,
      loadWeightTons: dto.loadWeightTons,
      estimatedFreight: dto.estimatedFreight,
      actualFreight: dto.actualFreight,
      driverName,
      driverUserId: dto.driverUserId,
      isEmptyReturn: dto.isEmptyReturn ?? false,
      notes: dto.notes,
    });
  }

  findAll(
    organizationId: string,
    filters?: {
      vehicleId?: string;
      driverId?: string;
      customerId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.trips.findAllByOrganization(organizationId, filters);
  }

  async findOne(organizationId: string, id: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');

    const profitability = ProfitabilityUtil.calculateEstimatedAndActual({
      estimatedFreight:
        trip.estimatedFreight != null ? ProfitabilityUtil.toNumber(trip.estimatedFreight) : null,
      actualFreight:
        trip.actualFreight != null ? ProfitabilityUtil.toNumber(trip.actualFreight) : null,
      expenses: trip.expenses,
      fuelTransactions: trip.fuelTransactions,
      estimatedDistanceKm:
        trip.estimatedDistanceKm != null
          ? ProfitabilityUtil.toNumber(trip.estimatedDistanceKm)
          : null,
      actualDistanceKm:
        trip.actualDistanceKm != null ? ProfitabilityUtil.toNumber(trip.actualDistanceKm) : null,
      loadWeightTons:
        trip.loadWeightTons != null ? ProfitabilityUtil.toNumber(trip.loadWeightTons) : null,
    });

    return { ...trip, profitability };
  }

  async update(organizationId: string, id: string, dto: UpdateTripDto) {
    const existing = await this.trips.findByIdForOrganization(id, organizationId);
    if (!existing) throw new NotFoundException('Trip not found');

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled trip');
    }
    if (existing.status === 'COMPLETED' && dto.status && dto.status !== 'COMPLETED') {
      throw new BadRequestException('Cannot change status of a completed trip');
    }

    if (dto.status && dto.status !== existing.status) {
      this.assertTransition(existing.status, dto.status);
    }

    if (dto.vehicleId && dto.vehicleId !== existing.vehicleId) {
      await this.validateVehicle(organizationId, dto.vehicleId);
    }

    let driverName = dto.driverName;
    if (dto.driverId !== undefined) {
      if (dto.driverId === (null as unknown as string)) {
        // PartialType keeps string | undefined; disconnect via explicit null not supported in DTO
      }
      if (dto.driverId) {
        const driver = await this.validateDriverForAssignment(organizationId, dto.driverId);
        driverName = driverName ?? driver.name;
      }
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId },
      });
      if (!customer) throw new BadRequestException('Customer not found in your organization');
    }

    this.validateFreightAndDates(dto, existing.startDate);

    const nextStatus = dto.status;
    const assigningDriver = Boolean(dto.driverId);
    const resolvedStatus =
      !nextStatus && assigningDriver && existing.status === 'PLANNED' ? 'ASSIGNED' : nextStatus;

    return this.trips.update(id, organizationId, {
      ...(resolvedStatus !== undefined && { status: resolvedStatus }),
      ...(dto.vehicleId !== undefined && { vehicle: { connect: { id: dto.vehicleId } } }),
      ...(dto.driverId !== undefined && {
        driver: dto.driverId ? { connect: { id: dto.driverId } } : { disconnect: true },
      }),
      ...(dto.customerId !== undefined && {
        customer: dto.customerId ? { connect: { id: dto.customerId } } : { disconnect: true },
      }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && {
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      }),
      ...(dto.originName !== undefined && { originName: dto.originName.trim() }),
      ...(dto.destinationName !== undefined && { destinationName: dto.destinationName.trim() }),
      ...(dto.estimatedDistanceKm !== undefined && {
        estimatedDistanceKm: dto.estimatedDistanceKm,
      }),
      ...(dto.actualDistanceKm !== undefined && { actualDistanceKm: dto.actualDistanceKm }),
      ...(dto.loadWeightTons !== undefined && { loadWeightTons: dto.loadWeightTons }),
      ...(dto.estimatedFreight !== undefined && { estimatedFreight: dto.estimatedFreight }),
      ...(dto.actualFreight !== undefined && { actualFreight: dto.actualFreight }),
      ...(driverName !== undefined && { driverName }),
      ...(dto.isEmptyReturn !== undefined && { isEmptyReturn: dto.isEmptyReturn }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
  }

  async complete(organizationId: string, id: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === 'COMPLETED') return this.findOne(organizationId, id);
    if (trip.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled trip');
    }

    this.assertTransition(trip.status, 'COMPLETED');

    await this.trips.update(id, organizationId, {
      status: 'COMPLETED',
      endDate: trip.endDate ?? new Date(),
    });

    return this.findOne(organizationId, id);
  }

  async getDashboardSummary(organizationId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [todayTrips, activeTrips, completedTrips, completedFinancials] = await Promise.all([
      this.trips.countStartingOnDay(organizationId, dayStart, dayEnd),
      this.prisma.trip.count({
        where: {
          organizationId,
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        },
      }),
      this.trips.countByStatus(organizationId, 'COMPLETED'),
      this.trips.getFinancialAggregateByOrganization(organizationId),
    ]);

    let revenue = 0;
    let expenses = 0;
    let fuelCost = 0;

    for (const trip of completedFinancials) {
      revenue += ProfitabilityUtil.toNumber(trip.actualFreight ?? trip.estimatedFreight);
      for (const expense of trip.expenses) {
        expenses += ProfitabilityUtil.toNumber(expense.amount);
      }
      for (const fuel of trip.fuelTransactions) {
        const amount = ProfitabilityUtil.toNumber(fuel.totalAmount);
        expenses += amount;
        fuelCost += amount;
      }
    }

    return {
      todayTrips,
      activeTrips,
      completedTrips,
      fleet: {
        revenue: round2(revenue),
        expenses: round2(expenses),
        profit: round2(revenue - expenses),
        fuelCost: round2(fuelCost),
        tripCount: completedFinancials.length,
      },
    };
  }

  async getVehiclePerformance(organizationId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const trips = await this.trips.getFinancialAggregateByVehicle(organizationId, vehicleId);

    let revenue = 0;
    let expenseTotal = 0;
    let distance = 0;
    let fuelLitres = 0;

    for (const trip of trips) {
      revenue += ProfitabilityUtil.toNumber(trip.actualFreight ?? trip.estimatedFreight);
      distance += ProfitabilityUtil.toNumber(trip.actualDistanceKm ?? trip.estimatedDistanceKm);
      for (const expense of trip.expenses) {
        expenseTotal += ProfitabilityUtil.toNumber(expense.amount);
      }
      for (const fuel of trip.fuelTransactions) {
        expenseTotal += ProfitabilityUtil.toNumber(fuel.totalAmount);
        fuelLitres += ProfitabilityUtil.toNumber(fuel.litres);
      }
    }

    const profit = revenue - expenseTotal;

    return {
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      tripCount: trips.length,
      revenue: round2(revenue),
      expenses: round2(expenseTotal),
      profit: round2(profit),
      distanceKm: round2(distance),
      revenuePerKm: distance > 0 ? round2(revenue / distance) : null,
      costPerKm: distance > 0 ? round2(expenseTotal / distance) : null,
      profitPerKm: distance > 0 ? round2(profit / distance) : null,
      fuelLitres: round2(fuelLitres),
      fuelEfficiencyKmPerLitre: fuelLitres > 0 ? round2(distance / fuelLitres) : null,
      targetKmPerLitre:
        vehicle.targetKmPerLitre != null
          ? ProfitabilityUtil.toNumber(vehicle.targetKmPerLitre)
          : null,
    };
  }

  private async validateVehicle(organizationId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
    });
    if (!vehicle) {
      throw new ForbiddenException('Vehicle not found in your organization');
    }
    if (vehicle.status === 'INACTIVE') {
      throw new BadRequestException('Cannot assign an inactive vehicle');
    }
    return vehicle;
  }

  private async validateDriverForAssignment(organizationId: string, driverId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });
    if (!driver) {
      throw new ForbiddenException('Driver not found in your organization');
    }
    if (driver.status === 'INACTIVE' || driver.status === 'SUSPENDED') {
      throw new BadRequestException(`Cannot assign a driver with status ${driver.status}`);
    }
    return driver;
  }

  private assertTransition(from: TripStatus, to: TripStatus) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`);
    }
  }

  private validateFreightAndDates(dto: Partial<CreateTripDto>, existingStart?: Date) {
    const start = dto.startDate ? new Date(dto.startDate) : existingStart;
    if (dto.endDate && start && new Date(dto.endDate) < start) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    if (dto.estimatedFreight !== undefined && dto.estimatedFreight < 0) {
      throw new BadRequestException('estimatedFreight must be >= 0');
    }
    if (dto.actualFreight !== undefined && dto.actualFreight < 0) {
      throw new BadRequestException('actualFreight must be >= 0');
    }
  }

  private async generateTripNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.trip.count({ where: { organizationId } });
    const seq = String(count + 1).padStart(4, '0');
    return `TRP-${year}-${seq}`;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
