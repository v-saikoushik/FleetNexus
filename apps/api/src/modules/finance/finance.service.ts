import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EXPENSE_TYPES,
  type ExpenseType,
  type FinanceCashFlowBucket,
  type FinanceDashboardSummary,
  type FinanceExpenseEntry,
  type FinanceInsight,
  type FinanceOutstandingItem,
  type FinancePeriodType,
  type FinanceReportPeriod,
  type FinanceTripProfitability,
  type FinanceVehicleProfitability,
} from '@fleetnexus/shared';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
import { ProfitabilityUtil } from '@/modules/intelligence/profitability/profitability.util';
import type { FinancePeriodQueryDto } from './dto/finance-period-query.dto';
import { FinanceRepository, type FinanceRange } from './finance.repository';

type TripRecord = Awaited<ReturnType<FinanceRepository['findCompletedTrips']>>[number];
type ExpenseRecord = Awaited<ReturnType<FinanceRepository['findExpensesForPeriod']>>[number];
type FuelRecord = Awaited<ReturnType<FinanceRepository['findFuelTransactionsForPeriod']>>[number];
type FinanceData = {
  trips: TripRecord[];
  expenses: ExpenseRecord[];
  fuels: FuelRecord[];
};
type TripResult = {
  trip: TripRecord;
  revenue: number | null;
  costs: number;
  profit: number | null;
  marginPct: number | null;
  distanceKm: number | null;
  costPerKm: number | null;
  fuelCost: number;
  received: number;
  outstanding: number | null;
};
type Bucket = FinanceCashFlowBucket & { endDate: Date };

const MAINTENANCE_TYPES = new Set<ExpenseType>(['MAINTENANCE', 'REPAIRS', 'TYRES']);

@Injectable()
export class FinanceService {
  constructor(private readonly finance: FinanceRepository) {}

  async getSummary(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    return this.summarize(await this.loadData(organizationId, period), period);
  }

  async getTrips(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    const [data, vehicles, customers] = await Promise.all([
      this.loadData(organizationId, period),
      this.finance.findVehiclesForOrganization(organizationId),
      this.finance.findCustomersForOrganization(organizationId),
    ]);
    const vehicleNames = new Map(
      vehicles.map((vehicle) => [vehicle.id, vehicle.registrationNumber]),
    );
    const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));

    return {
      period: this.toPeriodResponse(period),
      data: data.trips.map((trip) => {
        const result = this.evaluateTrip(trip);
        return {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          startDate: trip.startDate.toISOString(),
          vehicleId: trip.vehicleId,
          vehicleRegistrationNumber: vehicleNames.get(trip.vehicleId) ?? null,
          customerId: trip.customerId,
          customerName: trip.customerId ? (customerNames.get(trip.customerId) ?? null) : null,
          revenue: result.revenue,
          costs: result.costs,
          profit: result.profit,
          marginPct: result.marginPct,
          costPerKm: result.costPerKm,
          distanceKm: result.distanceKm,
        } satisfies FinanceTripProfitability;
      }),
    };
  }

  async getVehicles(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    const [data, vehicles] = await Promise.all([
      this.loadData(organizationId, period),
      this.finance.findVehiclesForOrganization(organizationId),
    ]);
    return {
      period: this.toPeriodResponse(period),
      data: this.calculateVehicles(data, vehicles),
    };
  }

  async getExpenses(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    const [expenses, vehicles, trips] = await Promise.all([
      this.finance.findExpensesForPeriod(organizationId, period),
      this.finance.findVehiclesForOrganization(organizationId),
      this.finance.findCompletedTrips(organizationId, period),
    ]);
    const vehicleNames = new Map(
      vehicles.map((vehicle) => [vehicle.id, vehicle.registrationNumber]),
    );
    const tripNumbers = new Map(trips.map((trip) => [trip.id, trip.tripNumber]));
    const toEntry = (expense: ExpenseRecord): FinanceExpenseEntry => ({
      id: expense.id,
      type: expense.type,
      amount: ProfitabilityUtil.toNumber(expense.amount),
      date: expense.date.toISOString(),
      description: expense.description,
      referenceNumber: expense.referenceNumber,
      tripId: expense.tripId,
      tripNumber: expense.tripId ? (tripNumbers.get(expense.tripId) ?? null) : null,
      vehicleId: expense.vehicleId,
      vehicleRegistrationNumber: expense.vehicleId
        ? (vehicleNames.get(expense.vehicleId) ?? null)
        : null,
    });
    const recent = expenses.slice(0, 10).map(toEntry);
    const highValue = [...expenses]
      .sort(
        (left, right) =>
          ProfitabilityUtil.toNumber(right.amount) - ProfitabilityUtil.toNumber(left.amount),
      )
      .slice(0, 10)
      .map(toEntry);
    return { period: this.toPeriodResponse(period), recent, highValue };
  }

  async getOutstanding(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    const [trips, customers] = await Promise.all([
      this.finance.findCompletedTrips(organizationId, period),
      this.finance.findCustomersForOrganization(organizationId),
    ]);
    const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
    const data: FinanceOutstandingItem[] = trips.flatMap((trip) => {
      const revenue = trip.actualFreight ?? trip.estimatedFreight;
      if (revenue === null) return [];
      const collection = PaymentCollectionUtil.calculate(revenue, trip.payments);
      if (collection.outstanding === null || collection.outstanding <= 0) return [];
      return [
        {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          customerId: trip.customerId,
          customerName: trip.customerId ? (customerNames.get(trip.customerId) ?? null) : null,
          revenue: collection.revenue ?? 0,
          received: collection.received,
          outstanding: collection.outstanding,
        },
      ];
    });
    return { period: this.toPeriodResponse(period), data };
  }

  async getCashFlow(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const period = this.resolvePeriod(query);
    const [payments, expenses, fuels] = await Promise.all([
      this.finance.findReceivedPaymentsForPeriod(organizationId, period),
      this.finance.findExpensesForPeriod(organizationId, period),
      this.finance.findFuelTransactionsForPeriod(organizationId, period),
    ]);
    const buckets = this.createBuckets(period);
    for (const payment of payments) {
      if (!payment.paymentDate) continue;
      const index = this.findBucket(buckets, payment.paymentDate);
      if (index >= 0) buckets[index].moneyIn += ProfitabilityUtil.toNumber(payment.amount);
    }
    for (const expense of expenses) {
      const index = this.findBucket(buckets, expense.date);
      if (index >= 0) buckets[index].moneyOut += this.costOf([expense], []);
    }
    for (const fuel of fuels) {
      const index = this.findBucket(buckets, fuel.date);
      if (index >= 0) buckets[index].moneyOut += this.costOf([], [fuel]);
    }
    const result = buckets.map((bucket) => ({
      label: bucket.label,
      startDate: bucket.startDate,
      moneyIn: this.round2(bucket.moneyIn),
      moneyOut: this.round2(bucket.moneyOut),
      netCashFlow: this.round2(bucket.moneyIn - bucket.moneyOut),
    }));
    const moneyIn = this.round2(
      payments.reduce((total, payment) => total + ProfitabilityUtil.toNumber(payment.amount), 0),
    );
    const moneyOut = this.costOf(expenses, fuels);
    return {
      period: this.toPeriodResponse(period),
      moneyIn,
      moneyOut,
      netCashFlow: this.round2(moneyIn - moneyOut),
      basis:
        'Operational cash flow from recorded payments and costs; not double-entry accounting.' as const,
      buckets: result,
    };
  }

  async getInsights(organizationId: string, query: FinancePeriodQueryDto = {}) {
    const currentPeriod = this.resolvePeriod(query);
    const previousPeriod = this.previousPeriod(currentPeriod);
    const [currentData, previousData, vehicles] = await Promise.all([
      this.loadData(organizationId, currentPeriod),
      this.loadData(organizationId, previousPeriod),
      this.finance.findVehiclesForOrganization(organizationId),
    ]);
    const current = this.summarize(currentData, currentPeriod);
    const previous = this.summarize(previousData, previousPeriod);
    const insights: FinanceInsight[] = [];

    const largestCategory = (
      Object.entries(current.expenses.byCategory) as [ExpenseType, number][]
    ).sort((left, right) => right[1] - left[1])[0];
    if (largestCategory && largestCategory[1] > 0) {
      insights.push({
        type: 'LARGEST_EXPENSE_CATEGORY',
        message: `${largestCategory[0].replaceAll('_', ' ')} is your largest recorded expense category for this period.`,
        currentValue: largestCategory[1],
        baselineValue: null,
        unit: 'INR',
      });
    }

    const currentMaintenance = this.maintenanceTotal(current.expenses.byCategory);
    const previousMaintenance = this.maintenanceTotal(previous.expenses.byCategory);
    if (currentMaintenance > previousMaintenance) {
      insights.push({
        type: 'MAINTENANCE_INCREASE',
        message: 'Recorded maintenance expenses increased compared with the previous period.',
        currentValue: currentMaintenance,
        baselineValue: previousMaintenance,
        unit: 'INR',
      });
    }

    const vehicleReports = this.calculateVehicles(currentData, vehicles).filter(
      (vehicle) => vehicle.costPerKm !== null,
    );
    if (vehicleReports.length > 1) {
      const average =
        vehicleReports.reduce((total, vehicle) => total + (vehicle.costPerKm ?? 0), 0) /
        vehicleReports.length;
      const highest = [...vehicleReports].sort(
        (left, right) => (right.costPerKm ?? 0) - (left.costPerKm ?? 0),
      )[0];
      if ((highest.costPerKm ?? 0) > average) {
        insights.push({
          type: 'VEHICLE_COST_PER_KM',
          message: `${highest.registrationNumber} has a higher recorded cost/km than the reporting fleet average.`,
          currentValue: highest.costPerKm ?? 0,
          baselineValue: average,
          unit: 'INR_PER_KM',
        });
      }
    }

    return { period: this.toPeriodResponse(currentPeriod), data: insights };
  }

  resolvePeriod(query: FinancePeriodQueryDto): FinanceRange & { period: FinancePeriodType } {
    if (Boolean(query.startDate) !== Boolean(query.endDate)) {
      throw new BadRequestException('startDate and endDate must be provided together');
    }
    if (query.startDate && query.endDate) {
      const startDate = new Date(query.startDate);
      const endDate = this.endOfQueryDate(query.endDate);
      if (startDate > endDate) throw new BadRequestException('startDate cannot be after endDate');
      return { period: query.period ?? 'MONTHLY', startDate, endDate };
    }

    const period = query.period ?? 'MONTHLY';
    const today = new Date();
    const startDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (period === 'WEEKLY') {
      startDate.setUTCDate(startDate.getUTCDate() - ((startDate.getUTCDay() + 6) % 7));
      return { period, startDate, endDate: this.endOfDay(this.addDays(startDate, 7)) };
    }
    if (period === 'MONTHLY') {
      startDate.setUTCDate(1);
      return {
        period,
        startDate,
        endDate: this.endOfDay(
          new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)),
        ),
      };
    }
    if (period === 'QUARTERLY') {
      startDate.setUTCMonth(Math.floor(startDate.getUTCMonth() / 3) * 3, 1);
      return {
        period,
        startDate,
        endDate: this.endOfDay(
          new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 3, 1)),
        ),
      };
    }
    startDate.setUTCMonth(0, 1);
    return {
      period,
      startDate,
      endDate: this.endOfDay(new Date(Date.UTC(startDate.getUTCFullYear() + 1, 0, 1))),
    };
  }

  private async loadData(organizationId: string, range: FinanceRange): Promise<FinanceData> {
    const [trips, expenses, fuels] = await Promise.all([
      this.finance.findCompletedTrips(organizationId, range),
      this.finance.findExpensesForPeriod(organizationId, range),
      this.finance.findFuelTransactionsForPeriod(organizationId, range),
    ]);
    return { trips, expenses, fuels };
  }

  private summarize(
    data: FinanceData,
    range: FinanceRange & { period: FinancePeriodType },
  ): FinanceDashboardSummary {
    const tripIds = new Set(data.trips.map((trip) => trip.id));
    const cohortExpenses = data.trips.flatMap((trip) => trip.expenses);
    const cohortFuels = data.trips.flatMap((trip) => trip.fuelTransactions);
    const periodExpensesOutsideCohort = data.expenses.filter(
      (expense) => !expense.tripId || !tripIds.has(expense.tripId),
    );
    const periodFuelsOutsideCohort = data.fuels.filter(
      (fuel) => !fuel.tripId || !tripIds.has(fuel.tripId),
    );
    const expenses = this.uniqueById([...cohortExpenses, ...periodExpensesOutsideCohort]);
    const fuels = this.uniqueById([...cohortFuels, ...periodFuelsOutsideCohort]);
    const costBreakdown = ProfitabilityUtil.buildExpensesFromRecords(expenses, fuels);
    const totalExpenses = this.round2(ProfitabilityUtil.calculateTotalCost(costBreakdown));
    const categoryTotals = Object.fromEntries(EXPENSE_TYPES.map((type) => [type, 0])) as Record<
      ExpenseType,
      number
    >;
    for (const expense of expenses) {
      categoryTotals[expense.type] += ProfitabilityUtil.toNumber(expense.amount);
    }
    for (const fuel of fuels) {
      categoryTotals.FUEL += ProfitabilityUtil.toNumber(fuel.totalAmount);
    }
    for (const type of EXPENSE_TYPES) categoryTotals[type] = this.round2(categoryTotals[type]);

    const tripResults = data.trips.map((trip) => this.evaluateTrip(trip));
    const finalizedResults = tripResults.filter(
      (result) => result.trip.financialStatus === 'FINALIZED',
    );
    const unfinalizedResults = tripResults.filter(
      (result) => result.trip.financialStatus !== 'FINALIZED',
    );
    const financialTotals = (results: TripResult[]) => ({
      tripCount: results.length,
      revenue: this.round2(results.reduce((total, result) => total + (result.revenue ?? 0), 0)),
      recordedExpenses: this.round2(results.reduce((total, result) => total + result.costs, 0)),
      profit: this.round2(results.reduce((total, result) => total + (result.profit ?? 0), 0)),
    });
    const revenueResults = tripResults.filter((result) => result.revenue !== null);
    const totalRevenue = this.round2(
      revenueResults.reduce((total, result) => total + (result.revenue ?? 0), 0),
    );
    const revenueTripCount = revenueResults.filter((result) => (result.revenue ?? 0) > 0).length;
    const received = this.round2(tripResults.reduce((total, result) => total + result.received, 0));
    const outstanding = revenueResults.length
      ? this.round2(revenueResults.reduce((total, result) => total + (result.outstanding ?? 0), 0))
      : null;
    const profitMetrics = revenueResults.length
      ? ProfitabilityUtil.calculateTripProfitability(totalRevenue, costBreakdown)
      : null;

    const contributingTrips = tripResults.filter(
      (result) => result.costs > 0 || result.revenue !== null,
    );
    const noUnallocatedCost =
      this.costOf(periodExpensesOutsideCohort, periodFuelsOutsideCohort) === 0;
    const hasCompleteDistance =
      contributingTrips.length > 0 &&
      contributingTrips.every((result) => result.distanceKm !== null && result.distanceKm > 0);
    const totalDistance = hasCompleteDistance
      ? contributingTrips.reduce((total, result) => total + (result.distanceKm ?? 0), 0)
      : null;
    const perDistance =
      totalDistance !== null && noUnallocatedCost
        ? ProfitabilityUtil.calculateTripProfitability(totalRevenue, costBreakdown, totalDistance)
        : null;

    return {
      period: this.toPeriodResponse(range),
      revenue: {
        total: totalRevenue,
        tripCount: revenueTripCount,
        averagePerTrip: revenueTripCount ? this.round2(totalRevenue / revenueTripCount) : null,
      },
      cashReceived: received,
      outstanding,
      expenses: {
        total: totalExpenses,
        count: expenses.length + fuels.length,
        byCategory: categoryTotals,
      },
      profit: profitMetrics ? this.round2(profitMetrics.profit) : null,
      profitMarginPct:
        profitMetrics?.marginPct === null || profitMetrics?.marginPct === undefined
          ? null
          : this.round2(profitMetrics.marginPct),
      costPerKm: perDistance ? this.round2(perDistance.costPerKm ?? 0) : null,
      profitPerKm: profitMetrics && perDistance ? this.round2(perDistance.profitPerKm ?? 0) : null,
      revenueVsExpenses: { revenue: totalRevenue, expenses: totalExpenses },
      financialFinalization: {
        finalized: financialTotals(finalizedResults),
        unfinalized: financialTotals(unfinalizedResults),
      },
    };
  }

  private evaluateTrip(trip: TripRecord): TripResult {
    const estimatedFreight =
      trip.estimatedFreight === null ? null : ProfitabilityUtil.toNumber(trip.estimatedFreight);
    const actualFreight =
      trip.actualFreight === null ? null : ProfitabilityUtil.toNumber(trip.actualFreight);
    const estimatedDistanceKm =
      trip.estimatedDistanceKm === null
        ? null
        : ProfitabilityUtil.toNumber(trip.estimatedDistanceKm);
    const actualDistanceKm =
      trip.actualDistanceKm === null ? null : ProfitabilityUtil.toNumber(trip.actualDistanceKm);
    const result = ProfitabilityUtil.calculateEstimatedAndActual({
      estimatedFreight,
      actualFreight,
      expenses: trip.expenses,
      fuelTransactions: trip.fuelTransactions,
      estimatedDistanceKm,
      actualDistanceKm,
      loadWeightTons:
        trip.loadWeightTons === null ? null : ProfitabilityUtil.toNumber(trip.loadWeightTons),
    });
    const primary = result.actual ?? result.estimated;
    const costs = primary?.totalCost ?? this.costOf(trip.expenses, trip.fuelTransactions);
    const revenueValue = trip.actualFreight ?? trip.estimatedFreight;
    const revenue = revenueValue === null ? null : ProfitabilityUtil.toNumber(revenueValue);
    const distanceValue = trip.actualDistanceKm ?? trip.estimatedDistanceKm;
    const distanceKm = distanceValue === null ? null : ProfitabilityUtil.toNumber(distanceValue);
    const collection = PaymentCollectionUtil.calculate(revenueValue, trip.payments);
    return {
      trip,
      revenue,
      costs: this.round2(costs),
      profit: primary ? this.round2(primary.profit) : null,
      marginPct:
        primary?.marginPct === null || primary?.marginPct === undefined
          ? null
          : this.round2(primary.marginPct),
      distanceKm: distanceKm !== null && distanceKm > 0 ? distanceKm : null,
      costPerKm:
        primary?.costPerKm === null || primary?.costPerKm === undefined
          ? null
          : this.round2(primary.costPerKm),
      fuelCost: this.round2(
        ProfitabilityUtil.buildExpensesFromRecords(trip.expenses, trip.fuelTransactions).fuelCost,
      ),
      received: collection.received,
      outstanding: collection.outstanding,
    };
  }

  private calculateVehicles(
    data: FinanceData,
    vehicles: Awaited<ReturnType<FinanceRepository['findVehiclesForOrganization']>>,
  ): FinanceVehicleProfitability[] {
    const tripIds = new Set(data.trips.map((trip) => trip.id));
    const extraExpenses = data.expenses.filter(
      (expense) => !expense.tripId || !tripIds.has(expense.tripId),
    );
    const extraFuels = data.fuels.filter((fuel) => !fuel.tripId || !tripIds.has(fuel.tripId));
    const byVehicle = new Map<
      string,
      {
        trips: TripResult[];
        extraExpenses: ExpenseRecord[];
        extraFuels: FuelRecord[];
      }
    >();
    for (const trip of data.trips) {
      const group = byVehicle.get(trip.vehicleId) ?? {
        trips: [],
        extraExpenses: [],
        extraFuels: [],
      };
      group.trips.push(this.evaluateTrip(trip));
      byVehicle.set(trip.vehicleId, group);
    }
    for (const expense of extraExpenses) {
      if (!expense.vehicleId) continue;
      const group = byVehicle.get(expense.vehicleId) ?? {
        trips: [],
        extraExpenses: [],
        extraFuels: [],
      };
      group.extraExpenses.push(expense);
      byVehicle.set(expense.vehicleId, group);
    }
    for (const fuel of extraFuels) {
      const group = byVehicle.get(fuel.vehicleId) ?? {
        trips: [],
        extraExpenses: [],
        extraFuels: [],
      };
      group.extraFuels.push(fuel);
      byVehicle.set(fuel.vehicleId, group);
    }

    const vehicleNames = new Map(
      vehicles.map((vehicle) => [vehicle.id, vehicle.registrationNumber]),
    );
    const reports: FinanceVehicleProfitability[] = [];
    for (const [vehicleId, group] of byVehicle) {
      const registrationNumber = vehicleNames.get(vehicleId);
      if (!registrationNumber) continue;
      const revenueKnown =
        group.trips.length > 0 && group.trips.every((trip) => trip.revenue !== null);
      const revenue = revenueKnown
        ? this.round2(group.trips.reduce((total, trip) => total + (trip.revenue ?? 0), 0))
        : null;
      const tripExpenses = group.trips.flatMap((result) => result.trip.expenses);
      const tripFuels = group.trips.flatMap((result) => result.trip.fuelTransactions);
      const expenses = this.uniqueById([...tripExpenses, ...group.extraExpenses]);
      const fuels = this.uniqueById([...tripFuels, ...group.extraFuels]);
      const costBreakdown = ProfitabilityUtil.buildExpensesFromRecords(expenses, fuels);
      const costs = this.round2(ProfitabilityUtil.calculateTotalCost(costBreakdown));
      const profitMetrics =
        revenue === null
          ? null
          : ProfitabilityUtil.calculateTripProfitability(revenue, costBreakdown);
      const distanceTrips = group.trips.filter((trip) => trip.costs > 0 || trip.revenue !== null);
      const hasDistance =
        distanceTrips.length > 0 && distanceTrips.every((trip) => trip.distanceKm !== null);
      const totalDistance = hasDistance
        ? distanceTrips.reduce((total, trip) => total + (trip.distanceKm ?? 0), 0)
        : null;
      const distanceMetrics =
        totalDistance && totalDistance > 0
          ? ProfitabilityUtil.calculateTripProfitability(revenue ?? 0, costBreakdown, totalDistance)
          : null;
      reports.push({
        vehicleId,
        registrationNumber,
        tripCount: group.trips.length,
        revenue,
        expenses: costs,
        profit: profitMetrics ? this.round2(profitMetrics.profit) : null,
        profitMarginPct:
          profitMetrics?.marginPct === null || profitMetrics?.marginPct === undefined
            ? null
            : this.round2(profitMetrics.marginPct),
        fuelCost: this.round2(costBreakdown.fuelCost),
        costPerKm:
          distanceMetrics?.costPerKm === null || distanceMetrics?.costPerKm === undefined
            ? null
            : this.round2(distanceMetrics.costPerKm),
        revenuePerKm:
          revenue === null ||
          distanceMetrics?.revenuePerKm === null ||
          distanceMetrics?.revenuePerKm === undefined
            ? null
            : this.round2(distanceMetrics.revenuePerKm),
        profitPerKm:
          revenue === null ||
          distanceMetrics?.profitPerKm === null ||
          distanceMetrics?.profitPerKm === undefined
            ? null
            : this.round2(distanceMetrics.profitPerKm),
      });
    }
    return reports.sort((left, right) => (right.profit ?? -Infinity) - (left.profit ?? -Infinity));
  }

  private costOf(
    expenses: Array<{ type: string; amount: unknown }>,
    fuels: Array<{ totalAmount: unknown }>,
  ) {
    return this.round2(
      ProfitabilityUtil.calculateTotalCost(
        ProfitabilityUtil.buildExpensesFromRecords(
          expenses as { type: string; amount: number | string | { toNumber?: () => number } }[],
          fuels as { totalAmount: number | string | { toNumber?: () => number } }[],
        ),
      ),
    );
  }

  private uniqueById<T extends { id: string }>(rows: T[]): T[] {
    return [...new Map(rows.map((row) => [row.id, row])).values()];
  }

  private maintenanceTotal(categories: Record<ExpenseType, number>) {
    return this.round2(
      EXPENSE_TYPES.filter((type) => MAINTENANCE_TYPES.has(type)).reduce(
        (sum, type) => sum + categories[type],
        0,
      ),
    );
  }

  private createBuckets(range: FinanceRange & { period: FinancePeriodType }): Bucket[] {
    const starts: Date[] = [];
    if (range.period === 'WEEKLY') {
      for (
        let cursor = new Date(range.startDate);
        cursor <= range.endDate;
        cursor = this.addDays(cursor, 1)
      ) {
        starts.push(cursor);
      }
    } else if (range.period === 'MONTHLY') {
      for (
        let cursor = new Date(range.startDate);
        cursor <= range.endDate;
        cursor = this.addDays(cursor, 7)
      ) {
        starts.push(cursor);
      }
    } else {
      for (
        let cursor = new Date(
          Date.UTC(range.startDate.getUTCFullYear(), range.startDate.getUTCMonth(), 1),
        );
        cursor <= range.endDate;
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
      ) {
        starts.push(cursor);
      }
    }
    return starts.map((startDate, index) => {
      const next = starts[index + 1] ?? this.addDays(range.endDate, 1);
      const label =
        range.period === 'WEEKLY'
          ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' }).format(startDate)
          : range.period === 'MONTHLY'
            ? `Week ${index + 1}`
            : new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(startDate);
      return {
        label,
        startDate: startDate.toISOString(),
        endDate: next,
        moneyIn: 0,
        moneyOut: 0,
        netCashFlow: 0,
      };
    });
  }

  private findBucket(buckets: Bucket[], date: Date): number {
    return buckets.findIndex((bucket) => {
      const start = new Date(bucket.startDate);
      return date >= start && date < bucket.endDate;
    });
  }

  private toPeriodResponse(
    range: FinanceRange & { period: FinancePeriodType },
  ): FinanceReportPeriod {
    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    };
  }

  private previousPeriod(range: FinanceRange & { period: FinancePeriodType }) {
    const duration = range.endDate.getTime() - range.startDate.getTime() + 1;
    const endDate = new Date(range.startDate.getTime() - 1);
    const startDate = new Date(endDate.getTime() - duration + 1);
    return { period: range.period, startDate, endDate };
  }

  private endOfQueryDate(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private endOfDay(nextDay: Date): Date {
    return new Date(nextDay.getTime() - 1);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
