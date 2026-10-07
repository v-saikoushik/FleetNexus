import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BUSINESS_MEMORY_SAMPLE_THRESHOLDS,
  COST_INTELLIGENCE_THRESHOLDS,
  EXPENSE_TYPES,
  type ExpenseType,
  type RouteIntelligenceComparison,
  type RouteIntelligenceFlag,
  type RouteIntelligenceReport,
  type RouteIntelligenceSegment,
} from '@fleetnexus/shared';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
import { ProfitabilityUtil } from './profitability/profitability.util';
import { RouteIntelligenceRepository } from './route-intelligence.repository';

const MIN_TRIPS = BUSINESS_MEMORY_SAMPLE_THRESHOLDS.limited;
type Trip = Awaited<ReturnType<RouteIntelligenceRepository['findCompletedTrips']>>[number];
type Route = NonNullable<Awaited<ReturnType<RouteIntelligenceRepository['findRoute']>>>;
type Evaluated = {
  source: Trip;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  margin: number | null;
  distance: number | null;
  fuelCost: number;
  litres: number;
  fuelRows: number;
  cash: number;
};

@Injectable()
export class RouteIntelligenceService {
  constructor(private readonly repository: RouteIntelligenceRepository) {}

  async getRoutes(organizationId: string) {
    const [routes, trips, locations] = await Promise.all([
      this.repository.findRoutes(organizationId),
      this.repository.findCompletedTrips(organizationId),
      this.repository.findLocations(organizationId),
    ]);
    return {
      data: routes.map((route) => ({
        id: route.id,
        label: this.routeLabel(route, locations),
        tripCount: trips.filter((trip) => trip.routeId === route.id).length,
      })),
    };
  }

  async getAnalysis(organizationId: string, routeId: string): Promise<RouteIntelligenceReport> {
    const [
      route,
      trips,
      standaloneExpenses,
      allTrips,
      allStandaloneExpenses,
      routes,
      locations,
      vehiclesByOrg,
      customersByOrg,
      commoditiesByOrg,
    ] = await Promise.all([
      this.repository.findRoute(organizationId, routeId),
      this.repository.findCompletedTrips(organizationId, routeId),
      this.repository.findUnlinkedRouteExpenses(organizationId, routeId),
      this.repository.findCompletedTrips(organizationId),
      this.repository.findUnlinkedRouteExpenses(organizationId),
      this.repository.findRoutes(organizationId),
      this.repository.findLocations(organizationId),
      this.repository.findVehicles(organizationId),
      this.repository.findCustomers(organizationId),
      this.repository.findCommodities(organizationId),
    ]);
    if (!route) throw new NotFoundException('Route not found');
    const evaluated = trips.map((trip) => this.evaluate(trip));
    const fleetEvaluated = allTrips.map((trip) => this.evaluate(trip));
    const count = evaluated.length;
    const sufficient = count >= MIN_TRIPS;
    const allRevenueKnown = count > 0 && evaluated.every((trip) => trip.revenue !== null);
    const revenue = allRevenueKnown ? this.sum(evaluated.map((trip) => trip.revenue ?? 0)) : null;
    const expenses =
      this.sum(evaluated.map((trip) => trip.expenses)) +
      this.sum(standaloneExpenses.map((item) => ProfitabilityUtil.toNumber(item.amount)));
    const profit = revenue === null ? null : this.round2(revenue - expenses);
    const allDistancesKnown = count > 0 && evaluated.every((trip) => trip.distance !== null);
    const distance = allDistancesKnown
      ? this.sum(evaluated.map((trip) => trip.distance ?? 0))
      : null;
    const marginPct = revenue && profit !== null ? this.round2((profit / revenue) * 100) : null;
    const performance = {
      tripCount: count,
      revenue,
      cashReceived: this.sum(evaluated.map((trip) => trip.cash)),
      expenses,
      profit,
      averageRevenuePerTrip: revenue === null || !count ? null : this.round2(revenue / count),
      averageExpensePerTrip: count ? this.round2(expenses / count) : null,
      averageProfitPerTrip: profit === null || !count ? null : this.round2(profit / count),
      averageMarginPct: marginPct,
      totalDistanceKm: distance,
      averageDistancePerTrip: distance === null || !count ? null : this.round2(distance / count),
      costPerKm: distance && distance > 0 ? this.round2(expenses / distance) : null,
      revenuePerKm:
        revenue !== null && distance && distance > 0 ? this.round2(revenue / distance) : null,
      profitPerKm:
        profit !== null && distance && distance > 0 ? this.round2(profit / distance) : null,
    };
    const categories = this.emptyCategories();
    for (const trip of trips) {
      for (const expense of trip.expenses)
        categories[expense.type] += ProfitabilityUtil.toNumber(expense.amount);
      for (const fuel of trip.fuelTransactions)
        categories.FUEL += ProfitabilityUtil.toNumber(fuel.totalAmount);
    }
    for (const item of standaloneExpenses)
      categories[item.type] += ProfitabilityUtil.toNumber(item.amount);
    const expenseBreakdown = EXPENSE_TYPES.map((type) => ({
      type,
      total: this.round2(categories[type]),
      averagePerTrip: count ? this.round2(categories[type] / count) : null,
      sharePct: expenses > 0 ? this.round2((categories[type] / expenses) * 100) : null,
    }));
    const totalFuel = this.sum(evaluated.map((trip) => trip.fuelCost));
    const totalLitres = this.sum(evaluated.map((trip) => trip.litres));
    const fuelComplete =
      count > 0 &&
      evaluated.every((trip) => trip.fuelRows > 0) &&
      allDistancesKnown &&
      count >= MIN_TRIPS;
    const fleetFuelTrips = fleetEvaluated.filter(
      (trip) => trip.fuelRows > 0 && trip.distance !== null,
    );
    const fleetFuelKm = this.sum(fleetFuelTrips.map((trip) => trip.distance ?? 0));
    const fleetFuelAmount = this.sum(fleetFuelTrips.map((trip) => trip.fuelCost));
    const fleetFuelCostPerKm =
      fleetFuelKm > 0 && fleetFuelTrips.length >= MIN_TRIPS
        ? this.round2(fleetFuelAmount / fleetFuelKm)
        : null;
    const fuelCostPerKm =
      fuelComplete && distance && distance > 0 ? this.round2(totalFuel / distance) : null;
    const fuel = {
      sufficientData: fuelComplete,
      explanation: fuelComplete
        ? `Fuel totals use linked fuel transactions across ${count} completed trips.`
        : 'Insufficient fuel data for this route.',
      totalCost: totalFuel > 0 ? this.round2(totalFuel) : null,
      averageCostPerTrip: totalFuel > 0 && count ? this.round2(totalFuel / count) : null,
      totalLitres: totalLitres > 0 ? this.round2(totalLitres) : null,
      fuelCostPerKm,
      kmPerLitre:
        fuelComplete && totalLitres > 0 && distance ? this.round2(distance / totalLitres) : null,
      fleetFuelCostPerKm,
    };
    const tollCost = this.round2(categories.TOLL);
    const tollSharePct = expenses > 0 ? this.round2((tollCost / expenses) * 100) : null;
    const otherRouteReports = routes
      .filter((item) => item.id !== routeId)
      .map((item) => {
        const rows = allTrips
          .filter((trip) => trip.routeId === item.id)
          .map((trip) => this.evaluate(trip));
        if (rows.length < MIN_TRIPS) return null;
        const routeExpenses = allStandaloneExpenses.filter(
          (expense) => expense.routeId === item.id,
        );
        const rowExpense =
          this.sum(rows.map((trip) => trip.expenses)) +
          this.sum(routeExpenses.map((expense) => ProfitabilityUtil.toNumber(expense.amount)));
        const linkedToll =
          this.sum(
            allTrips
              .filter((trip) => trip.routeId === item.id)
              .flatMap((trip) =>
                trip.expenses
                  .filter((expense) => expense.type === 'TOLL')
                  .map((expense) => ProfitabilityUtil.toNumber(expense.amount)),
              ),
          ) +
          this.sum(
            routeExpenses
              .filter((expense) => expense.type === 'TOLL')
              .map((expense) => ProfitabilityUtil.toNumber(expense.amount)),
          );
        return rowExpense > 0 ? (linkedToll / rowExpense) * 100 : null;
      });
    const comparableTollShares = otherRouteReports.filter(
      (value): value is number => value !== null,
    );
    const otherRoutesAverageSharePct = comparableTollShares.length
      ? this.round2(this.sum(comparableTollShares) / comparableTollShares.length)
      : null;
    const vehicleNames = new Map(vehiclesByOrg.map((item) => [item.id, item.registrationNumber]));
    const customerNames = new Map(customersByOrg.map((item) => [item.id, item.name]));
    const commodityNames = new Map(commoditiesByOrg.map((item) => [item.id, item.name]));
    const grouped = (key: (trip: Trip) => { id: string; name: string } | null) => {
      const groups = new Map<string, { label: string; rows: Evaluated[] }>();
      for (const trip of trips) {
        const item = key(trip);
        if (!item) continue;
        const group = groups.get(item.id) ?? { label: item.name, rows: [] };
        group.rows.push(this.evaluate(trip));
        groups.set(item.id, group);
      }
      return [...groups.entries()].map(([id, group]) => this.segment(id, group.label, group.rows));
    };
    const vehicles = grouped((trip) =>
      vehicleNames.has(trip.vehicleId)
        ? { id: trip.vehicleId, name: vehicleNames.get(trip.vehicleId)! }
        : null,
    );
    const commodities = grouped((trip) =>
      trip.commodityId && commodityNames.has(trip.commodityId)
        ? { id: trip.commodityId, name: commodityNames.get(trip.commodityId)! }
        : null,
    );
    const customers = grouped((trip) =>
      trip.customerId && customerNames.has(trip.customerId)
        ? { id: trip.customerId, name: customerNames.get(trip.customerId)! }
        : null,
    );
    const routeFleetCostPerKm = this.fleetAverage(fleetEvaluated, 'cost');
    const routeFleetProfitPerKm = this.fleetAverage(fleetEvaluated, 'profit');
    const flags: RouteIntelligenceFlag[] = [];
    if (!sufficient)
      flags.push(
        this.flag(
          'INSUFFICIENT_ROUTE_DATA',
          'INFO',
          'Insufficient route data',
          `This route has ${count} completed trip${count === 1 ? '' : 's'}; at least ${MIN_TRIPS} are needed for route comparisons.`,
          'Completed trips',
          count,
          MIN_TRIPS,
          count,
        ),
      );
    if (
      sufficient &&
      performance.costPerKm !== null &&
      routeFleetCostPerKm !== null &&
      performance.costPerKm > routeFleetCostPerKm * COST_INTELLIGENCE_THRESHOLDS.highCostPerKmRatio
    )
      flags.push(
        this.flag(
          'HIGH_COST_ROUTE',
          'WARNING',
          'Cost/km above route fleet average',
          `Average cost/km is ${this.percentAbove(performance.costPerKm, routeFleetCostPerKm)}% above comparable fleet routes across ${count} trips.`,
          'Cost/km',
          performance.costPerKm,
          routeFleetCostPerKm,
          count,
        ),
      );
    if (
      sufficient &&
      marginPct !== null &&
      marginPct < COST_INTELLIGENCE_THRESHOLDS.lowProfitMarginPct
    )
      flags.push(
        this.flag(
          'LOW_MARGIN_ROUTE',
          'WARNING',
          'Low recorded route margin',
          `Recorded route margin is ${marginPct}% across ${count} completed trips.`,
          'Margin',
          marginPct,
          COST_INTELLIGENCE_THRESHOLDS.lowProfitMarginPct,
          count,
        ),
      );
    const tollIsHigh =
      tollSharePct !== null &&
      (tollSharePct >= COST_INTELLIGENCE_THRESHOLDS.highTollRouteSharePct ||
        (otherRoutesAverageSharePct !== null &&
          tollSharePct >
            otherRoutesAverageSharePct * COST_INTELLIGENCE_THRESHOLDS.highCostPerKmRatio));
    if (sufficient && tollIsHigh && tollSharePct !== null)
      flags.push(
        this.flag(
          'HIGH_TOLL_BURDEN',
          'WARNING',
          'High toll share',
          otherRoutesAverageSharePct !== null &&
            tollSharePct >
              otherRoutesAverageSharePct * COST_INTELLIGENCE_THRESHOLDS.highCostPerKmRatio
            ? `Tolls are ${tollSharePct}% of recorded route expenses, above the comparable route average of ${otherRoutesAverageSharePct}%, across ${count} completed trips.`
            : `Tolls are ${tollSharePct}% of recorded route expenses across ${count} completed trips.`,
          'Toll share',
          tollSharePct,
          otherRoutesAverageSharePct ?? COST_INTELLIGENCE_THRESHOLDS.highTollRouteSharePct,
          count,
        ),
      );
    if (
      sufficient &&
      fuelCostPerKm !== null &&
      fleetFuelCostPerKm !== null &&
      fuelCostPerKm > fleetFuelCostPerKm * COST_INTELLIGENCE_THRESHOLDS.fuelCostPerKmRatio
    )
      flags.push(
        this.flag(
          'HIGH_FUEL_COST',
          'WARNING',
          'Fuel cost/km above fleet average',
          `Linked fuel cost/km is ${this.percentAbove(fuelCostPerKm, fleetFuelCostPerKm)}% above the route fleet baseline.`,
          'Fuel cost/km',
          fuelCostPerKm,
          fleetFuelCostPerKm,
          count,
        ),
      );
    if (
      sufficient &&
      performance.profitPerKm !== null &&
      routeFleetProfitPerKm !== null &&
      routeFleetProfitPerKm > 0 &&
      performance.profitPerKm <
        routeFleetProfitPerKm * COST_INTELLIGENCE_THRESHOLDS.lowTripProfitRatio
    )
      flags.push(
        this.flag(
          'LOW_PROFIT_PER_KM',
          'WARNING',
          'Profit/km below route fleet average',
          `Recorded profit/km is below the comparable fleet route baseline across ${count} trips.`,
          'Profit/km',
          performance.profitPerKm,
          routeFleetProfitPerKm,
          count,
        ),
      );
    const label = this.routeLabel(route, locations);
    const insights: string[] = [];
    if (marginPct !== null && revenue !== null)
      insights.push(
        `This route has produced a ${marginPct}% average margin across ${count} completed trips (revenue ${this.money(revenue)}, expenses ${this.money(expenses)}, profit ${profit === null ? 'unavailable' : this.money(profit)}).`,
      );
    if (tollSharePct !== null && tollCost > 0)
      insights.push(
        `Toll accounts for ${tollSharePct}% of recorded route expenses across ${count} trips.`,
      );
    const comparableVehicles = vehicles
      .filter((vehicle) => vehicle.sufficientData && vehicle.costPerKm !== null)
      .sort((a, b) => (a.costPerKm ?? Infinity) - (b.costPerKm ?? Infinity));
    if (comparableVehicles.length)
      insights.push(
        `${comparableVehicles[0].label} has historically recorded the lowest cost/km on this route across ${comparableVehicles[0].tripCount} comparable trips.`,
      );
    const commodityMargin = commodities
      .filter((item) => item.sufficientData && item.marginPct !== null)
      .sort((a, b) => (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity));
    if (
      commodityMargin.length > 1 &&
      commodityMargin[0].marginPct !== commodityMargin.at(-1)?.marginPct
    )
      insights.push(
        `${commodityMargin[0].label} has historically recorded a higher average margin than ${commodityMargin.at(-1)?.label} on this route (${commodityMargin[0].marginPct}% across ${commodityMargin[0].tripCount} trips).`,
      );
    return {
      route: {
        id: route.id,
        label,
        estimatedDistanceKm:
          route.estimatedDistance === null
            ? null
            : this.round2(ProfitabilityUtil.toNumber(route.estimatedDistance)),
        tripCount: count,
      },
      sampleSize: count,
      sufficientData: sufficient,
      explanation:
        count === 0
          ? 'No completed trips are recorded for this route.'
          : count >= BUSINESS_MEMORY_SAMPLE_THRESHOLDS.supported
            ? `More useful historical comparison based on ${count} completed trips.`
            : sufficient
              ? `Limited historical comparison based on ${count} completed trips.`
              : `Historical record exists, but at least ${MIN_TRIPS} completed trips are required for comparisons.`,
      performance,
      expenses: expenseBreakdown,
      fuel,
      toll: {
        totalCost: tollCost,
        averagePerTrip: count ? this.round2(tollCost / count) : null,
        costPerKm: distance && distance > 0 ? this.round2(tollCost / distance) : null,
        sharePct: tollSharePct,
        otherRoutesAverageSharePct,
      },
      vehicles,
      commodities,
      customers,
      flags,
      insights,
    };
  }

  async getDimension(
    organizationId: string,
    routeId: string,
    dimension: 'vehicles' | 'commodities' | 'customers',
  ) {
    const report = await this.getAnalysis(organizationId, routeId);
    return {
      route: report.route,
      sampleSize: report.sampleSize,
      sufficientData: report.sufficientData,
      explanation: report.explanation,
      data: report[dimension],
    };
  }

  async getExpenses(organizationId: string, routeId: string) {
    const report = await this.getAnalysis(organizationId, routeId);
    return {
      route: report.route,
      sampleSize: report.sampleSize,
      sufficientData: report.sufficientData,
      explanation: report.explanation,
      data: report.expenses,
      toll: report.toll,
      fuel: report.fuel,
    };
  }

  async compare(organizationId: string, metric: string): Promise<RouteIntelligenceComparison> {
    const options = await this.getRoutes(organizationId);
    const reports = await Promise.all(
      options.data.map((item) => this.getAnalysis(organizationId, item.id)),
    );
    const map: Record<string, (report: RouteIntelligenceReport) => number | null> = {
      averageProfit: (report) => report.performance.averageProfitPerTrip,
      averageMargin: (report) => report.performance.averageMarginPct,
      costPerKm: (report) => report.performance.costPerKm,
      profitPerKm: (report) => report.performance.profitPerKm,
      tollShare: (report) => report.toll.sharePct,
      fuelCostPerKm: (report) => report.fuel.fuelCostPerKm,
      tripCount: (report) => report.performance.tripCount,
    };
    const getValue = map[metric];
    if (!getValue) throw new NotFoundException('Unsupported route comparison metric');
    const values = reports.map((report) => ({
      routeId: report.route.id,
      routeLabel: report.route.label,
      tripCount: report.sampleSize,
      value: getValue(report),
    }));
    const comparable = values.filter(
      (item) => item.value !== null && (metric === 'tripCount' || item.tripCount >= MIN_TRIPS),
    );
    return {
      metric,
      sampleSize: comparable.reduce((sum, item) => sum + item.tripCount, 0),
      sufficientData: comparable.length >= 2,
      explanation:
        comparable.length >= 2
          ? `Compared ${comparable.length} routes with sufficient history for ${metric}.`
          : `Insufficient route data to compare ${metric}; at least two routes need ${MIN_TRIPS} completed trips and an available value.`,
      routes: values,
    };
  }

  async getInsights(organizationId: string) {
    const options = await this.getRoutes(organizationId);
    const reports = await Promise.all(
      options.data.map((item) => this.getAnalysis(organizationId, item.id)),
    );
    return {
      sampleSize: reports.reduce((sum, report) => sum + report.sampleSize, 0),
      sufficientData: reports.some((report) => report.sufficientData),
      explanation:
        'Rule-based route insights are derived from completed trips and recorded expenses/fuel only.',
      data: reports.flatMap((report) =>
        report.flags.map((flag) => ({
          ...flag,
          routeId: report.route.id,
          routeLabel: report.route.label,
        })),
      ),
    };
  }

  private evaluate(trip: Trip): Evaluated {
    const revenueValue = trip.actualFreight ?? trip.estimatedFreight;
    const revenue = revenueValue === null ? null : ProfitabilityUtil.toNumber(revenueValue);
    const breakdown = ProfitabilityUtil.buildExpensesFromRecords(
      trip.expenses,
      trip.fuelTransactions,
    );
    const expenses = ProfitabilityUtil.calculateTotalCost(breakdown);
    const profit = revenue === null ? null : this.round2(revenue - expenses);
    const distanceValue = trip.actualDistanceKm ?? trip.estimatedDistanceKm;
    const distance =
      distanceValue === null || ProfitabilityUtil.toNumber(distanceValue) <= 0
        ? null
        : ProfitabilityUtil.toNumber(distanceValue);
    const margin = revenue && profit !== null ? this.round2((profit / revenue) * 100) : null;
    return {
      source: trip,
      revenue,
      expenses: this.round2(expenses),
      profit,
      margin,
      distance,
      fuelCost: this.round2(breakdown.fuelCost),
      litres: this.sum(
        trip.fuelTransactions.map((fuel) => ProfitabilityUtil.toNumber(fuel.litres)),
      ),
      fuelRows: trip.fuelTransactions.length,
      cash: PaymentCollectionUtil.calculate(revenueValue, trip.payments).received,
    };
  }

  private segment(id: string, label: string, trips: Evaluated[]): RouteIntelligenceSegment {
    const count = trips.length;
    const revenueComplete = count > 0 && trips.every((trip) => trip.revenue !== null);
    const revenue = revenueComplete ? this.sum(trips.map((trip) => trip.revenue ?? 0)) : null;
    const expenses = this.sum(trips.map((trip) => trip.expenses));
    const profit = revenue === null ? null : this.round2(revenue - expenses);
    const distancesComplete = count > 0 && trips.every((trip) => trip.distance !== null);
    const distance = distancesComplete ? this.sum(trips.map((trip) => trip.distance ?? 0)) : null;
    const fuelComplete =
      count >= MIN_TRIPS && trips.every((trip) => trip.fuelRows > 0) && distancesComplete;
    const fuelCost = this.sum(trips.map((trip) => trip.fuelCost));
    const litres = this.sum(trips.map((trip) => trip.litres));
    return {
      id,
      label,
      tripCount: count,
      revenue,
      expenses,
      profit,
      marginPct: revenue && profit !== null ? this.round2((profit / revenue) * 100) : null,
      averageFreight: revenue === null || !count ? null : this.round2(revenue / count),
      costPerKm: distance && distance > 0 ? this.round2(expenses / distance) : null,
      profitPerKm:
        profit !== null && distance && distance > 0 ? this.round2(profit / distance) : null,
      fuelCost: fuelCost > 0 ? this.round2(fuelCost) : 0,
      fuelCostPerKm:
        fuelComplete && distance && distance > 0 ? this.round2(fuelCost / distance) : null,
      fuelLitres: fuelComplete && litres > 0 ? this.round2(litres) : null,
      kmPerLitre: fuelComplete && litres > 0 && distance ? this.round2(distance / litres) : null,
      sufficientData: count >= MIN_TRIPS,
      explanation:
        count >= BUSINESS_MEMORY_SAMPLE_THRESHOLDS.supported
          ? `More useful comparison based on ${count} completed trips.`
          : count >= MIN_TRIPS
            ? `Limited comparison based on ${count} completed trips.`
            : `Insufficient comparison data: ${count} trips recorded; ${MIN_TRIPS} required.`,
    };
  }

  private fleetAverage(trips: Evaluated[], metric: 'cost' | 'profit') {
    const valid = trips.filter(
      (trip) => trip.distance !== null && (metric === 'cost' || trip.profit !== null),
    );
    const distance = this.sum(valid.map((trip) => trip.distance ?? 0));
    const amount = this.sum(
      valid.map((trip) => (metric === 'cost' ? trip.expenses : (trip.profit ?? 0))),
    );
    return valid.length >= MIN_TRIPS && distance > 0 ? this.round2(amount / distance) : null;
  }

  private emptyCategories(): Record<ExpenseType, number> {
    return Object.fromEntries(EXPENSE_TYPES.map((type) => [type, 0])) as Record<
      ExpenseType,
      number
    >;
  }
  private flag(
    code: RouteIntelligenceFlag['code'],
    severity: RouteIntelligenceFlag['severity'],
    title: string,
    explanation: string,
    metric: string,
    value: number | null,
    baseline: number | null,
    sampleSize: number,
  ): RouteIntelligenceFlag {
    return { code, severity, title, explanation, metric, value, baseline, sampleSize };
  }
  private routeLabel(
    route: Route,
    locations: Array<{ id: string; name: string; city: string | null; state: string | null }>,
  ) {
    const byId = new Map(locations.map((item) => [item.id, item]));
    const origin = byId.get(route.originLocationId);
    const destination = byId.get(route.destinationLocationId);
    const labelOf = (location: typeof origin) =>
      location?.name || location?.city || location?.state || 'Unknown';
    return `${labelOf(origin)} → ${labelOf(destination)}`;
  }
  private sum(values: number[]) {
    return this.round2(values.reduce((sum, value) => sum + value, 0));
  }
  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
  private percentAbove(value: number, baseline: number) {
    return baseline === 0 ? 0 : this.round2((value / baseline - 1) * 100);
  }
  private money(value: number) {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }
}
