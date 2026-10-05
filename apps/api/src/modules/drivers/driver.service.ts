import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProfitabilityUtil } from '@/modules/intelligence/profitability/profitability.util';
import { DriverRepository } from './driver.repository';
import type { CreateDriverDto } from './dto/create-driver.dto';
import type { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriverService {
  constructor(private readonly drivers: DriverRepository) {}

  async create(organizationId: string, dto: CreateDriverDto) {
    try {
      return await this.drivers.create({
        organization: { connect: { id: organizationId } },
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        alternatePhone: dto.alternatePhone?.trim(),
        licenseNumber: dto.licenseNumber.trim().toUpperCase(),
        ...(dto.licenseExpiry && { licenseExpiry: new Date(dto.licenseExpiry) }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        address: dto.address,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes,
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  findAll(organizationId: string, filters?: { status?: string; search?: string }) {
    return this.drivers.findAllByOrganization(organizationId, filters);
  }

  async findOne(organizationId: string, id: string) {
    const driver = await this.drivers.findByIdForOrganization(id, organizationId);
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async update(organizationId: string, id: string, dto: UpdateDriverDto) {
    await this.findOne(organizationId, id);
    try {
      return await this.drivers.update(id, organizationId, {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone?.trim() }),
        ...(dto.licenseNumber !== undefined && {
          licenseNumber: dto.licenseNumber.trim().toUpperCase(),
        }),
        ...(dto.licenseExpiry !== undefined && {
          licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
        }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  /**
   * Performance foundation from completed trips — facts only, no driver score.
   */
  async getPerformance(organizationId: string, driverId: string) {
    await this.findOne(organizationId, driverId);
    const trips = await this.drivers.getCompletedTripsForDriver(organizationId, driverId);

    let totalDistanceKm = 0;
    let totalRevenue = 0;
    let totalExpenseAmount = 0;
    let totalFuelLitres = 0;
    let totalDurationHours = 0;
    let tripsWithDuration = 0;
    let allowanceTotal = 0;

    for (const trip of trips) {
      const distance = ProfitabilityUtil.toNumber(
        trip.actualDistanceKm ?? trip.estimatedDistanceKm,
      );
      totalDistanceKm += distance;
      totalRevenue += ProfitabilityUtil.toNumber(trip.actualFreight ?? trip.estimatedFreight);

      for (const expense of trip.expenses) {
        const amount = ProfitabilityUtil.toNumber(expense.amount);
        totalExpenseAmount += amount;
        if (
          expense.type === 'DRIVER_ALLOWANCE' ||
          expense.type === 'DRIVER_SALARY' ||
          expense.type === 'FOOD_ALLOWANCE'
        ) {
          allowanceTotal += amount;
        }
      }

      for (const fuel of trip.fuelTransactions) {
        totalFuelLitres += ProfitabilityUtil.toNumber(fuel.litres);
        totalExpenseAmount += ProfitabilityUtil.toNumber(fuel.totalAmount);
      }

      if (trip.startDate && trip.endDate) {
        const hours =
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
          (1000 * 60 * 60);
        if (hours > 0) {
          totalDurationHours += hours;
          tripsWithDuration += 1;
        }
      }
    }

    return {
      tripsCompleted: trips.length,
      totalDistanceKm: round2(totalDistanceKm),
      revenueHandled: round2(totalRevenue),
      totalExpensesAttributed: round2(totalExpenseAmount),
      allowanceAndDriverCosts: round2(allowanceTotal),
      totalFuelLitres: round2(totalFuelLitres),
      fuelEfficiencyKmPerLitre:
        totalFuelLitres > 0 ? round2(totalDistanceKm / totalFuelLitres) : null,
      averageDurationHours:
        tripsWithDuration > 0 ? round2(totalDurationHours / tripsWithDuration) : null,
      // Incidents are not modeled yet — return null rather than inventing data
      incidentCount: null as number | null,
    };
  }

  private handleDatabaseError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A driver with this license number already exists');
    }
    throw error;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
