import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TripStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { ProfitabilityUtil } from '@/modules/intelligence/profitability/profitability.util';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
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

    const collectionSummary = PaymentCollectionUtil.calculate(
      trip.actualFreight ?? trip.estimatedFreight,
      trip.payments,
    );

    return { ...trip, profitability, collectionSummary };
  }

  async reviewFinancials(organizationId: string, id: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');
    const report = this.buildFinancialReview(trip);
    let financialStatus = trip.financialStatus;
    if (financialStatus !== 'FINALIZED') {
      financialStatus = report.ready ? 'READY_FOR_REVIEW' : 'OPEN';
      await this.prisma.trip.updateMany({
        where: { id, organizationId, financialStatus: { not: 'FINALIZED' } },
        data: { financialStatus },
      });
    }
    return {
      ...report,
      financialStatus,
      completeness: { ...report.completeness, expensesReviewed: true },
    };
  }

  async finalizeFinancials(organizationId: string, id: string, userId: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');
    const report = this.buildFinancialReview(trip);
    if (trip.financialStatus === 'FINALIZED') {
      return {
        status: 'FINALIZED' as const,
        tripId: trip.id,
        financialStatus: 'FINALIZED' as const,
        financialFinalizedAt: trip.financialFinalizedAt,
        financialSummary: report.financialSummary,
        blockingIssues: [],
      };
    }
    const blockingIssues = [...report.blockingIssues];
    if (trip.financialStatus !== 'READY_FOR_REVIEW') {
      blockingIssues.unshift('Complete the financial review before finalizing.');
    }
    if (blockingIssues.length) {
      if (trip.financialStatus === 'READY_FOR_REVIEW') {
        await this.prisma.trip.updateMany({
          where: { id, organizationId, financialStatus: 'READY_FOR_REVIEW' },
          data: { financialStatus: 'OPEN' },
        });
      }
      return {
        status: 'NOT_READY' as const,
        tripId: trip.id,
        financialStatus:
          trip.financialStatus === 'READY_FOR_REVIEW' ? ('OPEN' as const) : trip.financialStatus,
        blockingIssues,
        financialSummary: report.financialSummary,
      };
    }
    const finalizedAt = new Date();
    const updated = await this.prisma.trip.updateMany({
      where: { id, organizationId, status: 'COMPLETED', financialStatus: 'READY_FOR_REVIEW' },
      data: {
        financialStatus: 'FINALIZED',
        financialFinalizedAt: finalizedAt,
        financialFinalizedById: userId,
      },
    });
    if (!updated.count) {
      const latest = await this.trips.findByIdForOrganization(id, organizationId);
      if (latest?.financialStatus === 'FINALIZED') {
        return {
          status: 'FINALIZED' as const,
          tripId: id,
          financialStatus: 'FINALIZED' as const,
          financialFinalizedAt: latest.financialFinalizedAt,
          financialSummary: report.financialSummary,
          blockingIssues: [],
        };
      }
      return {
        status: 'NOT_READY' as const,
        tripId: id,
        financialStatus: latest?.financialStatus ?? 'OPEN',
        blockingIssues: ['Trip status or review changed. Review the financials again.'],
        financialSummary: report.financialSummary,
      };
    }
    return {
      status: 'FINALIZED' as const,
      tripId: id,
      financialStatus: 'FINALIZED' as const,
      financialFinalizedAt: finalizedAt,
      financialSummary: report.financialSummary,
      blockingIssues: [],
    };
  }

  async reopenFinancials(organizationId: string, id: string) {
    const trip = await this.trips.findByIdForOrganization(id, organizationId);
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.financialStatus !== 'FINALIZED') {
      throw new ConflictException('Only finalized trip financials can be reopened');
    }
    await this.prisma.trip.updateMany({
      where: { id, organizationId, financialStatus: 'FINALIZED' },
      data: { financialStatus: 'OPEN', financialFinalizedAt: null, financialFinalizedById: null },
    });
    return {
      tripId: id,
      financialStatus: 'OPEN' as const,
      message: 'Financials reopened. Review and finalize again after corrections.',
    };
  }

  private buildFinancialReview(
    trip: NonNullable<Awaited<ReturnType<TripRepository['findByIdForOrganization']>>>,
  ) {
    const expenses = trip.expenses;
    const fuels = trip.fuelTransactions;
    const expenseCost = (types: string[]) =>
      expenses
        .filter((item) => types.includes(item.type))
        .reduce((sum, item) => sum + ProfitabilityUtil.toNumber(item.amount), 0);
    const category = (amount: number, count: number) => ({
      amount: round2(amount),
      recordCount: count,
      status: count ? ('RECORDED' as const) : ('MISSING' as const),
    });
    const fuel = category(
      expenseCost(['FUEL']) +
        fuels.reduce((sum, item) => sum + ProfitabilityUtil.toNumber(item.totalAmount), 0),
      expenses.filter((item) => item.type === 'FUEL').length + fuels.length,
    );
    const toll = category(
      expenseCost(['TOLL']),
      expenses.filter((item) => item.type === 'TOLL').length,
    );
    const driver = category(
      expenseCost(['DRIVER_ALLOWANCE', 'DRIVER_SALARY', 'FOOD_ALLOWANCE']),
      expenses.filter((item) =>
        ['DRIVER_ALLOWANCE', 'DRIVER_SALARY', 'FOOD_ALLOWANCE'].includes(item.type),
      ).length,
    );
    const loading = category(
      expenseCost(['LOADING']),
      expenses.filter((item) => item.type === 'LOADING').length,
    );
    const unloading = category(
      expenseCost(['UNLOADING']),
      expenses.filter((item) => item.type === 'UNLOADING').length,
    );
    const maintenance = category(
      expenseCost(['MAINTENANCE', 'REPAIRS', 'TYRES']),
      expenses.filter((item) => ['MAINTENANCE', 'REPAIRS', 'TYRES'].includes(item.type)).length,
    );
    const knownTypes = new Set([
      'FUEL',
      'TOLL',
      'DRIVER_ALLOWANCE',
      'DRIVER_SALARY',
      'FOOD_ALLOWANCE',
      'LOADING',
      'UNLOADING',
      'MAINTENANCE',
      'REPAIRS',
      'TYRES',
    ]);
    const otherItems = expenses.filter((item) => !knownTypes.has(item.type));
    const other = category(
      otherItems.reduce((sum, item) => sum + ProfitabilityUtil.toNumber(item.amount), 0),
      otherItems.length,
    );
    const breakdown = ProfitabilityUtil.buildExpensesFromRecords(expenses, fuels);
    const totalExpenses = round2(ProfitabilityUtil.calculateTotalCost(breakdown));
    const actualRevenue =
      trip.actualFreight === null ? null : ProfitabilityUtil.toNumber(trip.actualFreight);
    const estimatedRevenue =
      trip.estimatedFreight === null ? null : ProfitabilityUtil.toNumber(trip.estimatedFreight);
    const displayedRevenue = actualRevenue ?? estimatedRevenue;
    const revenueBasis =
      actualRevenue !== null ? 'ACTUAL' : estimatedRevenue !== null ? 'ESTIMATED' : 'MISSING';
    const actualDistance =
      trip.actualDistanceKm === null ? null : ProfitabilityUtil.toNumber(trip.actualDistanceKm);
    const estimatedDistance =
      trip.estimatedDistanceKm === null
        ? null
        : ProfitabilityUtil.toNumber(trip.estimatedDistanceKm);
    const distance = actualDistance ?? estimatedDistance;
    const distanceBasis =
      actualDistance !== null ? 'ACTUAL' : estimatedDistance !== null ? 'ESTIMATED' : 'MISSING';
    const recorded =
      actualRevenue === null
        ? null
        : ProfitabilityUtil.calculateTripProfitability(
            actualRevenue,
            breakdown,
            actualDistance ?? undefined,
          );
    const estimated =
      actualRevenue !== null || estimatedRevenue === null
        ? null
        : ProfitabilityUtil.calculateTripProfitability(
            estimatedRevenue,
            breakdown,
            distance ?? undefined,
          );
    const collections = PaymentCollectionUtil.calculate(displayedRevenue, trip.payments);
    const unresolvedPayments = trip.payments.filter(
      (payment) => payment.status === 'PENDING' || payment.status === 'OVERDUE',
    ).length;
    const blockingIssues: string[] = [];
    if (trip.status !== 'COMPLETED') blockingIssues.push('Trip must be operationally completed.');
    if (actualRevenue === null) blockingIssues.push('Actual trip freight is missing.');
    if (actualDistance === null || actualDistance <= 0)
      blockingIssues.push('Actual trip distance is missing.');
    const missingExpenseCategories = Object.entries({
      fuel,
      toll,
      driver,
      loading,
      unloading,
      maintenance,
      other,
    })
      .filter(([, item]) => item.status === 'MISSING')
      .map(([name]) => name);
    const warnings = [
      ...(expenses.length + fuels.length
        ? []
        : [
            'No trip expense or fuel records are available; recorded expenses currently total zero.',
          ]),
      ...(missingExpenseCategories.length
        ? [
            `No records exist for: ${missingExpenseCategories.join(', ')}. Absence is not treated as verified zero.`,
          ]
        : []),
      ...(trip.payments.length ? [] : ['No payment records are available.']),
      ...(unresolvedPayments
        ? [
            `${unresolvedPayments} payment record(s) are pending or overdue; collection is not finalized.`,
          ]
        : []),
      ...(revenueBasis === 'ESTIMATED'
        ? ['Revenue is estimated; actual freight is required for finalization.']
        : []),
      ...(distanceBasis === 'ESTIMATED'
        ? ['Distance is estimated; actual distance is required for finalization.']
        : []),
    ];
    return {
      tripId: trip.id,
      operationalStatus: trip.status,
      financialStatus: trip.financialStatus,
      ready: blockingIssues.length === 0,
      blockingIssues,
      warnings,
      completeness: {
        freight: { status: revenueBasis, amount: displayedRevenue },
        distance: { status: distanceBasis, kilometres: distance },
        expensesReviewed:
          trip.financialStatus === 'READY_FOR_REVIEW' || trip.financialStatus === 'FINALIZED',
        payments: {
          status: !trip.payments.length
            ? 'MISSING'
            : unresolvedPayments
              ? 'UNRESOLVED'
              : 'RECORDED',
          recordCount: trip.payments.length,
        },
      },
      missingExpenseCategories,
      financialSummary: {
        revenue: displayedRevenue === null ? null : round2(displayedRevenue),
        revenueBasis,
        paymentsReceived: collections.received,
        outstanding: collections.outstanding,
        expenses: {
          fuel,
          toll,
          driver,
          loading,
          unloading,
          maintenance,
          other,
          total: totalExpenses,
        },
        recordedProfit: recorded ? round2(recorded.profit) : null,
        recordedMarginPct:
          recorded?.marginPct === null || recorded?.marginPct === undefined
            ? null
            : round2(recorded.marginPct),
        costPerKm:
          recorded?.costPerKm === null || recorded?.costPerKm === undefined
            ? null
            : round2(recorded.costPerKm),
        profitPerKm:
          recorded?.profitPerKm === null || recorded?.profitPerKm === undefined
            ? null
            : round2(recorded.profitPerKm),
        estimatedProfit: estimated ? round2(estimated.profit) : null,
        distanceKm: distance,
        distanceBasis,
      },
    };
  }

  async update(organizationId: string, id: string, dto: UpdateTripDto) {
    const existing = await this.trips.findByIdForOrganization(id, organizationId);
    if (!existing) throw new NotFoundException('Trip not found');

    if (
      existing.financialStatus === 'FINALIZED' &&
      Object.keys(dto).some((key) => key !== 'notes')
    ) {
      throw new ConflictException(
        'Trip financials are finalized. Reopen financials before editing trip data.',
      );
    }

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
      ...(existing.financialStatus === 'READY_FOR_REVIEW' &&
        Object.keys(dto).some((key) => key !== 'notes') && { financialStatus: 'OPEN' }),
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
