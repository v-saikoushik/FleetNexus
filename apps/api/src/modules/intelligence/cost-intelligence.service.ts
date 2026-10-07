import { Injectable } from '@nestjs/common';
import {
  COST_INTELLIGENCE_THRESHOLDS as THRESHOLDS,
  EXPENSE_TYPES,
  type CostIntelligenceCategory,
  type CostIntelligenceCustomer,
  type CostIntelligenceFlag,
  type CostIntelligenceReport,
  type CostIntelligenceRoute,
  type CostIntelligenceSummary,
  type CostIntelligenceVehicle,
  type ExpenseType,
  type FinanceReportPeriod,
} from '@fleetnexus/shared';
import { FinanceService } from '@/modules/finance/finance.service';
import type { FinancePeriodQueryDto } from '@/modules/finance/dto/finance-period-query.dto';
import { ProfitabilityUtil } from './profitability/profitability.util';
import { CostIntelligenceRepository } from './cost-intelligence.repository';
import { BusinessMemoryService } from './business-memory.service';

type PeriodData = Awaited<ReturnType<CostIntelligenceService['loadPeriod']>>;
type CostTrip = Awaited<ReturnType<CostIntelligenceRepository['findCompletedTripCosts']>>[number];
type CategoryRecord = { id: string; type: string; amount: unknown };
type FuelRecord = { id: string; totalAmount: unknown };
type CategorizedCosts = { expenses: CategoryRecord[]; fuels: FuelRecord[] };

@Injectable()
export class CostIntelligenceService {
  constructor(
    private readonly finance: FinanceService,
    private readonly costs: CostIntelligenceRepository,
    private readonly businessMemory: BusinessMemoryService,
  ) {}

  async getSummary(
    organizationId: string,
    query: FinancePeriodQueryDto = {},
  ): Promise<CostIntelligenceSummary> {
    const [current, previous] = await Promise.all([
      this.loadPeriod(organizationId, query),
      this.loadPeriod(organizationId, this.previousQuery(query)),
    ]);
    const tripCount = current.trips.data.length;
    const distanceComplete =
      tripCount > 0 && current.trips.data.every((trip) => trip.distanceKm !== null);
    const totalDistanceKm = distanceComplete
      ? this.round2(current.trips.data.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0))
      : null;
    const totalProfit = current.summary.profit;
    const comparisonSufficient =
      tripCount >= THRESHOLDS.minimumTrips && previous.trips.data.length >= THRESHOLDS.minimumTrips;
    const categories = this.categoryTotals(current.summary, previous.summary, comparisonSufficient);
    const fleetSummary = current.summary;
    const perTripCount = fleetSummary.revenue.tripCount;
    return {
      period: fleetSummary.period,
      sampleSize: tripCount,
      sufficientData: tripCount >= THRESHOLDS.minimumTrips,
      explanation:
        tripCount >= THRESHOLDS.minimumTrips
          ? `Based on ${tripCount} completed trips. Cash received is collections and is separate from freight revenue.`
          : `Insufficient historical data. Based on ${tripCount} completed trips; trip-level comparison threshold is ${THRESHOLDS.minimumTrips}.`,
      totalRevenue: fleetSummary.revenue.total,
      cashReceived: fleetSummary.cashReceived,
      totalExpenses: fleetSummary.expenses.total,
      totalProfit,
      totalDistanceKm,
      costPerKm: fleetSummary.costPerKm,
      averageProfitPerTrip:
        totalProfit === null || !perTripCount ? null : this.round2(totalProfit / perTripCount),
      averageRevenuePerTrip: fleetSummary.revenue.averagePerTrip,
      averageExpensePerTrip: tripCount
        ? this.round2(fleetSummary.expenses.total / tripCount)
        : null,
      expenseToRevenuePct:
        fleetSummary.revenue.total > 0
          ? this.round2((fleetSummary.expenses.total / fleetSummary.revenue.total) * 100)
          : null,
      profitMarginPct: fleetSummary.profitMarginPct,
      comparison: {
        sufficientData: comparisonSufficient,
        explanation: comparisonSufficient
          ? `Current period compared with the previous period, using ${tripCount} current and ${previous.trips.data.length} previous completed trips.`
          : `Insufficient historical data for period comparison; at least ${THRESHOLDS.minimumTrips} trips are required in each period.`,
        revenueChangePct: comparisonSufficient
          ? this.changePct(fleetSummary.revenue.total, previous.summary.revenue.total)
          : null,
        expenseChangePct: comparisonSufficient
          ? this.changePct(fleetSummary.expenses.total, previous.summary.expenses.total)
          : null,
        profitChangePct:
          comparisonSufficient && totalProfit !== null && previous.summary.profit !== null
            ? this.changePct(totalProfit, previous.summary.profit)
            : null,
        costPerKmChangePct:
          comparisonSufficient &&
          fleetSummary.costPerKm !== null &&
          previous.summary.costPerKm !== null
            ? this.changePct(fleetSummary.costPerKm, previous.summary.costPerKm)
            : null,
        expenseCategories: categories,
      },
    };
  }

  async getExpenses(
    organizationId: string,
    query: FinancePeriodQueryDto = {},
  ): Promise<CostIntelligenceReport<CostIntelligenceCategory>> {
    const [current, previous] = await Promise.all([
      this.loadPeriod(organizationId, query),
      this.loadPeriod(organizationId, this.previousQuery(query)),
    ]);
    const all = this.categorizedCosts(current.tripCosts, current.expenses, current.fuels);
    const counts = new Map<ExpenseType, number>();
    for (const expense of all.expenses) this.increment(counts, expense.type as ExpenseType);
    if (all.fuels.length) counts.set('FUEL', (counts.get('FUEL') ?? 0) + all.fuels.length);
    const enough =
      current.trips.data.length >= THRESHOLDS.minimumTrips &&
      previous.trips.data.length >= THRESHOLDS.minimumTrips;
    const data = EXPENSE_TYPES.map((type) => {
      const totalAmount = current.summary.expenses.byCategory[type] ?? 0;
      const previousAmount = enough ? (previous.summary.expenses.byCategory[type] ?? 0) : null;
      const expenseCount = counts.get(type) ?? 0;
      const sampleSufficient = expenseCount >= THRESHOLDS.minimumTrips;
      return {
        type,
        label: this.label(type),
        totalAmount,
        sharePct:
          current.summary.expenses.total > 0
            ? this.round2((totalAmount / current.summary.expenses.total) * 100)
            : null,
        expenseCount,
        averageExpense: expenseCount ? this.round2(totalAmount / expenseCount) : null,
        previousAmount,
        trendChangePct:
          previousAmount === null ? null : this.changePct(totalAmount, previousAmount),
        sampleSufficient,
        explanation: sampleSufficient
          ? `${expenseCount} recorded ${this.label(type).toLowerCase()} cost entries${previousAmount === null ? '; insufficient trip history for a trend.' : ' compared with the previous period.'}`
          : `Insufficient historical data for a reliable ${this.label(type).toLowerCase()} comparison.`,
      } satisfies CostIntelligenceCategory;
    }).filter((item) => item.expenseCount > 0 || item.totalAmount > 0);
    return {
      period: current.summary.period,
      sampleSize: current.trips.data.length,
      sufficientData: current.trips.data.length >= THRESHOLDS.minimumTrips,
      explanation:
        current.trips.data.length >= THRESHOLDS.minimumTrips
          ? `Based on ${current.trips.data.length} completed trips. Category totals reuse Finance reporting calculations.`
          : `Insufficient historical data. Based on ${current.trips.data.length} completed trips.`,
      data,
    };
  }

  async getVehicles(
    organizationId: string,
    query: FinancePeriodQueryDto = {},
  ): Promise<CostIntelligenceReport<CostIntelligenceVehicle>> {
    const [periodData, period] = await Promise.all([
      this.loadPeriod(organizationId, query),
      Promise.resolve(this.finance.resolvePeriod(query)),
    ]);
    const fleetCostPerKm = periodData.summary.costPerKm;
    const vehicleTrips = new Map<string, typeof periodData.trips.data>();
    for (const trip of periodData.trips.data)
      vehicleTrips.set(trip.vehicleId, [...(vehicleTrips.get(trip.vehicleId) ?? []), trip]);
    const byVehicle = this.vehicleCostBreakdowns(
      periodData.tripCosts,
      periodData.expenses,
      periodData.fuels,
    );
    const fleetFuelPerKm = this.fleetFuelCostPerKm(periodData, vehicleTrips);
    const fleetTripCount = periodData.vehicles.data.reduce(
      (sum, vehicle) => sum + vehicle.tripCount,
      0,
    );
    const fleetAverageProfitPerTrip = fleetTripCount
      ? periodData.vehicles.data.reduce((sum, vehicle) => sum + (vehicle.profit ?? 0), 0) /
        fleetTripCount
      : 0;
    const data: CostIntelligenceVehicle[] = periodData.vehicles.data.map((vehicle) => {
      const trips = vehicleTrips.get(vehicle.vehicleId) ?? [];
      const sufficient = trips.length >= THRESHOLDS.minimumTrips;
      const distancesComplete = trips.length > 0 && trips.every((trip) => trip.distanceKm !== null);
      const distanceKm = distancesComplete
        ? this.round2(trips.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0))
        : null;
      const breakdown = this.emptyBreakdown();
      for (const record of byVehicle.get(vehicle.vehicleId) ?? [])
        breakdown[record.type] += record.amount;
      for (const type of EXPENSE_TYPES) breakdown[type] = this.round2(breakdown[type]);
      const fuelCostPerKm =
        distanceKm && distanceKm > 0 ? this.round2(vehicle.fuelCost / distanceKm) : null;
      const differencePct =
        fleetCostPerKm && vehicle.costPerKm !== null
          ? this.changePct(vehicle.costPerKm, fleetCostPerKm)
          : null;
      const flags = sufficient
        ? this.vehicleFlags(
            vehicle,
            trips,
            fleetCostPerKm,
            fleetFuelPerKm,
            fuelCostPerKm,
            fleetAverageProfitPerTrip,
            breakdown,
          )
        : [];
      return {
        ...vehicle,
        sufficientData: sufficient,
        explanation: sufficient
          ? `Based on ${trips.length} completed trips.`
          : `Insufficient historical data. Based on ${trips.length} completed trips; at least ${THRESHOLDS.minimumTrips} are required for vehicle comparisons.`,
        distanceKm,
        averageProfitPerTrip:
          vehicle.profit === null || !vehicle.tripCount
            ? null
            : this.round2(vehicle.profit / vehicle.tripCount),
        fuelCostPerKm,
        expenseBreakdown: breakdown,
        fleetCostPerKm,
        costPerKmDifferencePct: differencePct,
        flags,
      };
    });
    return {
      period: this.periodResponse(period),
      sampleSize: periodData.trips.data.length,
      sufficientData: periodData.trips.data.length >= THRESHOLDS.minimumTrips,
      explanation: `Vehicle costs are organization-scoped and use Finance profitability results. ${THRESHOLDS.minimumTrips} trips are required before vehicle flags are generated.`,
      data,
    };
  }

  async getCustomers(
    organizationId: string,
  ): Promise<CostIntelligenceReport<CostIntelligenceCustomer>> {
    const memory = await this.financeMemoryOverview(organizationId);
    const customerHistory = memory.customers;
    const usable = customerHistory.filter(
      (item) => item.pricedTripCount >= THRESHOLDS.minimumTrips && item.totalRevenue !== null,
    );
    const averageRevenue = usable.length
      ? usable.reduce((sum, item) => sum + (item.totalRevenue ?? 0), 0) / usable.length
      : null;
    const profitableCustomers = usable.filter(
      (item) => item.totalProfit !== null && item.tripCount > 0,
    );
    const averageProfitPerTrip = profitableCustomers.length
      ? profitableCustomers.reduce(
          (sum, item) => sum + (item.totalProfit ?? 0) / item.tripCount,
          0,
        ) / profitableCustomers.length
      : null;
    const data = customerHistory.map((item) => {
      const profitPerTrip =
        item.totalProfit === null || !item.tripCount ? null : item.totalProfit / item.tripCount;
      let segment: CostIntelligenceCustomer['segment'] = null;
      if (
        item.pricedTripCount >= THRESHOLDS.minimumTrips &&
        item.totalRevenue !== null &&
        item.marginPct !== null
      ) {
        if (
          averageProfitPerTrip !== null &&
          profitPerTrip !== null &&
          (profitPerTrip < 0 ||
            profitPerTrip < averageProfitPerTrip * THRESHOLDS.lowTripProfitRatio)
        )
          segment = 'CONSISTENTLY_LOW_PROFIT';
        else if (
          averageRevenue !== null &&
          item.totalRevenue >= averageRevenue &&
          item.marginPct < THRESHOLDS.lowProfitMarginPct
        )
          segment = 'HIGH_REVENUE_LOW_MARGIN';
        else if (
          averageRevenue !== null &&
          item.totalRevenue >= averageRevenue &&
          profitPerTrip !== null &&
          profitPerTrip > 0
        )
          segment = 'HIGH_REVENUE_HIGH_PROFIT';
        else if (
          averageRevenue !== null &&
          item.totalRevenue < averageRevenue &&
          item.marginPct >= THRESHOLDS.lowProfitMarginPct
        )
          segment = 'LOW_REVENUE_HIGH_MARGIN';
      }
      return {
        customerId: item.id,
        customerName: item.label,
        tripCount: item.tripCount,
        sufficientData: item.pricedTripCount >= THRESHOLDS.minimumTrips,
        revenue: item.totalRevenue,
        expenses: item.totalCost,
        profit: item.totalProfit,
        marginPct: item.marginPct,
        averageProfitPerTrip: profitPerTrip === null ? null : this.round2(profitPerTrip),
        segment,
        explanation:
          item.explanation + ' Customer comparison covers all available completed-trip history.',
      } satisfies CostIntelligenceCustomer;
    });
    return {
      period: null,
      sampleSize: customerHistory.reduce((sum, item) => sum + item.tripCount, 0),
      sufficientData: usable.length >= 2,
      explanation:
        'Customer profitability covers all available Business Memory history. Segment labels compare customers within this organization and are descriptive, not recommendations.',
      data,
    };
  }

  async getRoutes(organizationId: string): Promise<CostIntelligenceReport<CostIntelligenceRoute>> {
    const [memory, tripCosts] = await Promise.all([
      this.financeMemoryOverview(organizationId),
      this.costs.findCompletedTripCosts(organizationId),
    ]);
    const data = memory.routes.map((item) => {
      const distanceKm =
        item.averageCostPerKm && item.totalCost > 0
          ? this.round2(item.totalCost / item.averageCostPerKm)
          : null;
      const profitPerKm =
        distanceKm && item.totalProfit !== null ? this.round2(item.totalProfit / distanceKm) : null;
      const trips = tripCosts.filter(
        (trip) =>
          (trip.routeId ??
            `route:${this.normalize(`${trip.originName} → ${trip.destinationName}`)}`) === item.id,
      );
      const tollCost = trips.reduce(
        (sum, trip) =>
          sum +
          trip.expenses
            .filter((expense) => expense.type === 'TOLL')
            .reduce((cost, expense) => cost + ProfitabilityUtil.toNumber(expense.amount), 0),
        0,
      );
      const sufficientData = item.tripCount >= THRESHOLDS.minimumTrips;
      const flags: CostIntelligenceFlag[] = [];
      const tollShare = item.totalCost > 0 ? (tollCost / item.totalCost) * 100 : 0;
      if (sufficientData && tollShare >= THRESHOLDS.highTollRouteSharePct)
        flags.push(
          this.flag(
            'ROUTE_TOLL_COST_HIGH',
            'WARNING',
            'High recorded toll share',
            `${this.round2(tollShare)}% of recorded route costs are tolls across ${item.tripCount} historical trips.`,
            'Toll share',
            tollShare,
            THRESHOLDS.highTollRouteSharePct,
            'PERCENT',
            item.tripCount,
          ),
        );
      return {
        routeId: item.id,
        routeLabel: item.label,
        tripCount: item.tripCount,
        sufficientData,
        revenue: item.totalRevenue,
        expenses: item.totalCost,
        profit: item.totalProfit,
        distanceKm,
        costPerKm: item.averageCostPerKm,
        profitPerKm,
        averageMarginPct: item.marginPct,
        averageTripCost: item.tripCount ? this.round2(item.totalCost / item.tripCount) : null,
        tollCost: this.round2(tollCost),
        flags,
      } satisfies CostIntelligenceRoute;
    });
    return {
      period: null,
      sampleSize: memory.sampleSize,
      sufficientData: data.filter((item) => item.sufficientData).length > 0,
      explanation: `Route profitability and toll costs cover all available completed-trip history. At least ${THRESHOLDS.minimumTrips} historical trips are required for flags.`,
      data,
    };
  }

  async getInsights(
    organizationId: string,
    query: FinancePeriodQueryDto = {},
  ): Promise<CostIntelligenceReport<CostIntelligenceFlag>> {
    const [summary, categories, vehicles, customers, routes, period] = await Promise.all([
      this.getSummary(organizationId, query),
      this.getExpenses(organizationId, query),
      this.getVehicles(organizationId, query),
      this.getCustomers(organizationId),
      this.getRoutes(organizationId),
      Promise.resolve(this.finance.resolvePeriod(query)),
    ]);
    const flags: CostIntelligenceFlag[] = vehicles.data.flatMap((vehicle) => vehicle.flags);
    for (const category of categories.data) {
      if (
        category.sampleSufficient &&
        category.sharePct !== null &&
        category.sharePct >= THRESHOLDS.highExpenseCategorySharePct
      ) {
        flags.push(
          this.flag(
            'EXPENSE_CATEGORY_DISPROPORTIONATE',
            'INFO',
            `${category.label} is a large cost category`,
            `${category.label} represents ${category.sharePct}% of recorded expenses across ${category.expenseCount} cost entries.`,
            'Expense share',
            category.sharePct,
            THRESHOLDS.highExpenseCategorySharePct,
            'PERCENT',
            category.expenseCount,
          ),
        );
      }
    }
    for (const customer of customers.data) {
      if (
        customer.sufficientData &&
        customer.segment === 'HIGH_REVENUE_LOW_MARGIN' &&
        customer.marginPct !== null
      )
        flags.push(
          this.flag(
            'CUSTOMER_LOW_MARGIN',
            'WARNING',
            'High revenue with low recorded margin',
            `${customer.customerName} generated ${this.currency(customer.revenue ?? 0)} revenue at ${customer.marginPct}% margin across ${customer.tripCount} trips.`,
            'Profit margin',
            customer.marginPct,
            THRESHOLDS.lowProfitMarginPct,
            'PERCENT',
            customer.tripCount,
          ),
        );
    }
    for (const route of routes.data) flags.push(...route.flags);
    return {
      period: this.periodResponse(period),
      sampleSize: summary.sampleSize,
      sufficientData: summary.sufficientData,
      explanation: flags.length
        ? `Generated ${flags.length} rule-based insights from recorded operational data. ${summary.explanation}`
        : `No cost flags met the configured thresholds. ${summary.explanation}`,
      data: flags,
    };
  }

  private async loadPeriod(organizationId: string, query: FinancePeriodQueryDto) {
    const range = this.finance.resolvePeriod(query);
    const [summary, trips, vehicles, tripCosts, expenses, fuels] = await Promise.all([
      this.finance.getSummary(organizationId, query),
      this.finance.getTrips(organizationId, query),
      this.finance.getVehicles(organizationId, query),
      this.costs.findCompletedTripCosts(organizationId, range),
      this.costs.findExpensesForPeriod(organizationId, range),
      this.costs.findFuelForPeriod(organizationId, range),
    ]);
    return { range, summary, trips, vehicles, tripCosts, expenses, fuels };
  }

  private async financeMemoryOverview(organizationId: string) {
    return this.businessMemory.getOverview(organizationId);
  }

  private categorizedCosts(
    trips: CostTrip[],
    expenses: Awaited<ReturnType<CostIntelligenceRepository['findExpensesForPeriod']>>,
    fuels: Awaited<ReturnType<CostIntelligenceRepository['findFuelForPeriod']>>,
  ): CategorizedCosts {
    const tripIds = new Set(trips.map((trip) => trip.id));
    const allExpenses = [
      ...trips.flatMap((trip) => trip.expenses),
      ...expenses.filter((expense) => !expense.tripId || !tripIds.has(expense.tripId)),
    ];
    const allFuels = [
      ...trips.flatMap((trip) => trip.fuelTransactions),
      ...fuels.filter((fuel) => !fuel.tripId || !tripIds.has(fuel.tripId)),
    ];
    return {
      expenses: [...new Map(allExpenses.map((row) => [row.id, row])).values()],
      fuels: [...new Map(allFuels.map((row) => [row.id, row])).values()],
    };
  }

  private vehicleCostBreakdowns(
    trips: CostTrip[],
    expenses: Awaited<ReturnType<CostIntelligenceRepository['findExpensesForPeriod']>>,
    fuels: Awaited<ReturnType<CostIntelligenceRepository['findFuelForPeriod']>>,
  ) {
    const tripIds = new Set(trips.map((trip) => trip.id));
    const result = new Map<string, Array<{ type: ExpenseType; amount: number }>>();
    const add = (vehicleId: string, type: ExpenseType, amount: number) =>
      result.set(vehicleId, [...(result.get(vehicleId) ?? []), { type, amount }]);
    for (const trip of trips) {
      for (const expense of trip.expenses)
        add(trip.vehicleId, expense.type, ProfitabilityUtil.toNumber(expense.amount));
      for (const fuel of trip.fuelTransactions)
        add(trip.vehicleId, 'FUEL', ProfitabilityUtil.toNumber(fuel.totalAmount));
    }
    for (const expense of expenses.filter(
      (row) => (!row.tripId || !tripIds.has(row.tripId)) && row.vehicleId,
    ))
      add(expense.vehicleId!, expense.type, ProfitabilityUtil.toNumber(expense.amount));
    const fuelVehicles = new Map(fuels.map((row) => [row.id, row.vehicleId]));
    for (const fuel of fuels.filter((row) => !row.tripId || !tripIds.has(row.tripId))) {
      const vehicleId = fuelVehicles.get(fuel.id);
      if (vehicleId) add(vehicleId, 'FUEL', ProfitabilityUtil.toNumber(fuel.totalAmount));
    }
    return result;
  }

  private vehicleFlags(
    vehicle: PeriodData['vehicles']['data'][number],
    trips: PeriodData['trips']['data'],
    fleetCostPerKm: number | null,
    fleetFuelPerKm: number | null,
    fuelCostPerKm: number | null,
    fleetAverageProfitPerTrip: number,
    breakdown: Record<ExpenseType, number>,
  ): CostIntelligenceFlag[] {
    const flags: CostIntelligenceFlag[] = [];
    const difference =
      fleetCostPerKm && vehicle.costPerKm !== null
        ? (vehicle.costPerKm / fleetCostPerKm - 1) * 100
        : null;
    if (
      difference !== null &&
      vehicle.costPerKm !== null &&
      vehicle.costPerKm > fleetCostPerKm! * THRESHOLDS.highCostPerKmRatio
    )
      flags.push(
        this.flag(
          'HIGH_COST_PER_KM',
          'WARNING',
          'Cost/km above fleet average',
          `Vehicle cost/km is ${this.round2(difference)}% above the fleet average based on ${trips.length} completed trips.`,
          'Cost/km',
          vehicle.costPerKm,
          fleetCostPerKm,
          'INR_PER_KM',
          trips.length,
        ),
      );
    if (vehicle.profitMarginPct !== null && vehicle.profitMarginPct < THRESHOLDS.lowProfitMarginPct)
      flags.push(
        this.flag(
          'LOW_PROFIT_MARGIN',
          'WARNING',
          'Low recorded profit margin',
          `Recorded profit margin is ${this.round2(vehicle.profitMarginPct)}% across ${trips.length} completed trips.`,
          'Profit margin',
          vehicle.profitMarginPct,
          THRESHOLDS.lowProfitMarginPct,
          'PERCENT',
          trips.length,
        ),
      );
    const expenseRatio =
      vehicle.revenue && vehicle.revenue > 0 ? (vehicle.expenses / vehicle.revenue) * 100 : null;
    if (expenseRatio !== null && expenseRatio >= THRESHOLDS.highExpenseRatioPct)
      flags.push(
        this.flag(
          'HIGH_EXPENSE_RATIO',
          'ALERT',
          'Expenses close to or above revenue',
          `Recorded expenses are ${this.round2(expenseRatio)}% of revenue across ${trips.length} completed trips.`,
          'Expense/revenue ratio',
          expenseRatio,
          THRESHOLDS.highExpenseRatioPct,
          'PERCENT',
          trips.length,
        ),
      );
    const avgProfit =
      vehicle.profit === null || !vehicle.tripCount ? null : vehicle.profit / vehicle.tripCount;
    if (
      avgProfit !== null &&
      fleetAverageProfitPerTrip > 0 &&
      avgProfit < fleetAverageProfitPerTrip * THRESHOLDS.lowTripProfitRatio
    )
      flags.push(
        this.flag(
          'LOW_TRIP_PROFIT',
          'INFO',
          'Average trip profit below fleet level',
          `Average profit/trip is ${this.currency(avgProfit)} compared with the fleet average of ${this.currency(fleetAverageProfitPerTrip)}.`,
          'Average profit/trip',
          avgProfit,
          fleetAverageProfitPerTrip,
          'INR',
          trips.length,
        ),
      );
    if (
      fuelCostPerKm !== null &&
      fleetFuelPerKm !== null &&
      fleetFuelPerKm > 0 &&
      fuelCostPerKm > fleetFuelPerKm * THRESHOLDS.fuelCostPerKmRatio
    )
      flags.push(
        this.flag(
          'FUEL_COST_ANOMALY',
          'WARNING',
          'Fuel cost/km above fleet average',
          `Fuel cost/km is ${this.round2((fuelCostPerKm / fleetFuelPerKm - 1) * 100)}% above the fleet average across ${trips.length} completed trips.`,
          'Fuel cost/km',
          fuelCostPerKm,
          fleetFuelPerKm,
          'INR_PER_KM',
          trips.length,
        ),
      );
    const maintenance = ['MAINTENANCE', 'REPAIRS', 'TYRES'].reduce(
      (sum, type) => sum + breakdown[type as ExpenseType],
      0,
    );
    const maintenanceShare = vehicle.expenses > 0 ? (maintenance / vehicle.expenses) * 100 : 0;
    if (maintenanceShare >= THRESHOLDS.highMaintenanceSharePct && maintenance > 0)
      flags.push(
        this.flag(
          'MAINTENANCE_COST_HIGH',
          'WARNING',
          'Maintenance is a large vehicle cost',
          `Maintenance-related recorded expenses are ${this.round2(maintenanceShare)}% of vehicle costs across ${trips.length} trips.`,
          'Maintenance share',
          maintenanceShare,
          THRESHOLDS.highMaintenanceSharePct,
          'PERCENT',
          trips.length,
        ),
      );
    return flags;
  }

  private fleetFuelCostPerKm(data: PeriodData, vehicles: Map<string, PeriodData['trips']['data']>) {
    const valid = [...vehicles.values()].filter(
      (trips) => trips.length > 0 && trips.every((trip) => trip.distanceKm !== null),
    );
    const distance = valid.flat().reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0);
    const fuel = data.vehicles.data
      .filter((vehicle) => valid.some((trips) => trips[0]?.vehicleId === vehicle.vehicleId))
      .reduce((sum, vehicle) => sum + vehicle.fuelCost, 0);
    return distance > 0 ? this.round2(fuel / distance) : null;
  }

  private categoryTotals(
    current: Awaited<ReturnType<FinanceService['getSummary']>>,
    previous: Awaited<ReturnType<FinanceService['getSummary']>>,
    sufficient: boolean,
  ) {
    return Object.fromEntries(
      EXPENSE_TYPES.map((type) => {
        const currentValue = current.expenses.byCategory[type] ?? 0;
        const previousValue = previous.expenses.byCategory[type] ?? 0;
        return [
          type,
          {
            current: currentValue,
            previous: sufficient ? previousValue : null,
            changePct: sufficient ? this.changePct(currentValue, previousValue) : null,
          },
        ];
      }),
    ) as CostIntelligenceSummary['comparison']['expenseCategories'];
  }

  private previousQuery(query: FinancePeriodQueryDto): FinancePeriodQueryDto {
    const current = this.finance.resolvePeriod(query);
    const duration = current.endDate.getTime() - current.startDate.getTime() + 1;
    const endDate = new Date(current.startDate.getTime() - 1);
    const startDate = new Date(endDate.getTime() - duration + 1);
    return {
      period: current.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  private periodResponse(range: ReturnType<FinanceService['resolvePeriod']>): FinanceReportPeriod {
    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    };
  }

  private emptyBreakdown(): Record<ExpenseType, number> {
    return Object.fromEntries(EXPENSE_TYPES.map((type) => [type, 0])) as Record<
      ExpenseType,
      number
    >;
  }

  private increment(counts: Map<ExpenseType, number>, type: ExpenseType) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  private flag(
    code: CostIntelligenceFlag['code'],
    severity: CostIntelligenceFlag['severity'],
    title: string,
    explanation: string,
    metric: string,
    currentValue: number,
    baselineValue: number | null,
    unit: CostIntelligenceFlag['unit'],
    sampleSize: number,
  ): CostIntelligenceFlag {
    return {
      code,
      severity,
      title,
      explanation,
      metric,
      currentValue: this.round2(currentValue),
      baselineValue: baselineValue === null ? null : this.round2(baselineValue),
      unit,
      sampleSize,
    };
  }

  private changePct(current: number, previous: number): number | null {
    return previous === 0 ? null : this.round2(((current - previous) / Math.abs(previous)) * 100);
  }

  private label(type: ExpenseType) {
    return type
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private normalize(value: string) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }
  private currency(value: number) {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }
  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
