import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SEASONALITY_THRESHOLDS as THRESHOLDS,
  type SeasonalityComparison,
  type SeasonalityEntity,
  type SeasonalityMetrics,
  type SeasonalityMonthlyActivity,
  type SeasonalityOverview,
  type SeasonalityRelatedPattern,
  type SeasonalityStrength,
  type SeasonalityYearOverYear,
} from '@fleetnexus/shared';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
import { ProfitabilityUtil } from './profitability/profitability.util';
import { SeasonalityRepository } from './seasonality.repository';
import type { SeasonalityFilterQueryDto } from './dto/seasonality-filter-query.dto';
import type { SeasonalityComparisonQueryDto } from './dto/seasonality-comparison-query.dto';

type Trip = Awaited<ReturnType<SeasonalityRepository['findCompletedTrips']>>[number];
type Snapshot = {
  trips: Trip[];
  commodities: Awaited<ReturnType<SeasonalityRepository['findCommodities']>>;
  customers: Awaited<ReturnType<SeasonalityRepository['findCustomers']>>;
  routes: Awaited<ReturnType<SeasonalityRepository['findRoutes']>>;
  locations: Awaited<ReturnType<SeasonalityRepository['findLocations']>>;
  unlinkedExpenses: Awaited<ReturnType<SeasonalityRepository['findUnlinkedExpenses']>>;
  unlinkedFuelTransactions: Awaited<
    ReturnType<SeasonalityRepository['findUnlinkedFuelTransactions']>
  >;
};
type Evaluated = {
  source: Trip;
  year: number;
  month: number;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  margin: number | null;
  distance: number | null;
  cashReceived: number;
};
type GroupedTrip = { key: string; label: string; trips: Evaluated[] };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class SeasonalityService {
  constructor(private readonly repository: SeasonalityRepository) {}

  async getDemandHistory(
    organizationId: string,
    filter: { commodityId: string; routeId?: string },
  ) {
    const [commodity, route, snapshot] = await Promise.all([
      this.repository.findCommodity(organizationId, filter.commodityId),
      filter.routeId
        ? this.repository.findRoute(organizationId, filter.routeId)
        : Promise.resolve(null),
      this.loadSnapshot(organizationId),
    ]);
    if (!commodity || (filter.routeId && !route))
      throw new NotFoundException('Commodity or route not found');
    const selected = snapshot.trips.filter(
      (trip) =>
        trip.commodityId === filter.commodityId &&
        (!filter.routeId || trip.routeId === filter.routeId),
    );
    const counts = new Map<string, number>();
    for (const trip of selected) {
      const date = trip.startDate;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const keys = [...counts.keys()].sort();
    const series: Array<{ year: number; month: number; tripCount: number }> = [];
    if (keys.length) {
      const [firstYear, firstMonth] = keys[0].split('-').map(Number);
      const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);
      for (
        let cursor = firstYear * 12 + firstMonth - 1;
        cursor <= lastYear * 12 + lastMonth - 1;
        cursor++
      ) {
        const year = Math.floor(cursor / 12);
        const month = (cursor % 12) + 1;
        series.push({
          year,
          month,
          tripCount: counts.get(`${year}-${String(month).padStart(2, '0')}`) ?? 0,
        });
      }
    }
    return {
      label: filter.routeId
        ? `${this.routeLabel(route!, snapshot)} · ${commodity.name}`
        : commodity.name,
      commodityId: commodity.id,
      routeId: filter.routeId ?? null,
      tripCount: selected.length,
      series,
    };
  }

  async getOverview(
    organizationId: string,
    query: SeasonalityFilterQueryDto = {},
  ): Promise<SeasonalityOverview> {
    const snapshot = await this.loadSnapshot(organizationId);
    const trips = this.filter(this.evaluate(snapshot.trips), query);
    const monthlyExtraCosts = [
      ...snapshot.unlinkedExpenses
        .filter(
          (item) =>
            this.matchesDate(item.date, query) &&
            !query.commodityId &&
            !query.customerId &&
            (!query.routeId || item.routeId === query.routeId),
        )
        .map((item) => ({ date: item.date, amount: ProfitabilityUtil.toNumber(item.amount) })),
      ...snapshot.unlinkedFuelTransactions
        .filter(
          (item) =>
            this.matchesDate(item.date, query) &&
            !query.routeId &&
            !query.commodityId &&
            !query.customerId,
        )
        .map((item) => ({ date: item.date, amount: ProfitabilityUtil.toNumber(item.totalAmount) })),
    ];
    const monthlyActivity = this.monthlyActivity(trips, monthlyExtraCosts);
    const commodities = this.commoditySeries(snapshot, trips);
    const routeCommodities = this.routeCommoditySeries(snapshot, trips);
    const customers = this.customerSeries(snapshot, trips);
    const insights = [
      ...commodities.flatMap((item) => item.insights),
      ...routeCommodities.flatMap((item) => item.insights),
      ...customers.flatMap((item) => item.insights),
    ].slice(0, 30);
    return {
      filters: {
        year: query.year ?? null,
        startMonth: query.startMonth ?? null,
        endMonth: query.endMonth ?? null,
      },
      sampleSize: trips.length,
      sufficientData: trips.length >= THRESHOLDS.minimumTrips,
      explanation:
        trips.length >= THRESHOLDS.minimumTrips
          ? `Monthly activity summarizes ${trips.length} completed trips from recorded FleetNexus history. Dated expenses and fuel records without trip links are included in fleet monthly costs. Commodity, route and customer profitability uses costs linked to those trips. Cash received is kept separate from freight revenue. Seasonality requires at least ${THRESHOLDS.minimumTrips} trips across ${THRESHOLDS.minimumYears} years and ${THRESHOLDS.minimumMonthOfYearValues} observed calendar months.`
          : `Insufficient historical data: ${trips.length} completed trips match these filters. Historical averages are descriptive and are not predictions.`,
      monthlyActivity,
      commodities,
      routeCommodities,
      customers,
      insights,
    };
  }

  async getCommodities(organizationId: string, query: SeasonalityFilterQueryDto = {}) {
    const snapshot = await this.loadSnapshot(organizationId);
    const trips = this.filter(this.evaluate(snapshot.trips), query);
    return {
      sampleSize: trips.length,
      sufficientData: trips.length >= THRESHOLDS.minimumTrips,
      explanation: this.thresholdExplanation(),
      data: this.commoditySeries(snapshot, trips),
    };
  }

  async getRoutes(organizationId: string, query: SeasonalityFilterQueryDto = {}) {
    const snapshot = await this.loadSnapshot(organizationId);
    const trips = this.filter(this.evaluate(snapshot.trips), query);
    return {
      sampleSize: trips.length,
      data: snapshot.routes.map((route) => ({
        id: route.id,
        label: this.routeLabel(route, snapshot),
        tripCount: trips.filter((item) => item.source.routeId === route.id).length,
      })),
    };
  }

  async getCommodity(
    organizationId: string,
    commodityId: string,
    query: SeasonalityFilterQueryDto = {},
  ) {
    const [entity, snapshot] = await Promise.all([
      this.repository.findCommodity(organizationId, commodityId),
      this.loadSnapshot(organizationId),
    ]);
    if (!entity) throw new NotFoundException('Commodity not found');
    const trips = this.filter(this.evaluate(snapshot.trips), query).filter(
      (item) => item.source.commodityId === commodityId,
    );
    const commodity = this.makeSeries(commodityId, entity.name, trips);
    const related = this.routeCommoditySeries(snapshot, trips);
    const customers = this.customerSeries(snapshot, trips);
    return { commodity, routeCommodities: related, customers };
  }

  async getRoute(organizationId: string, routeId: string, query: SeasonalityFilterQueryDto = {}) {
    const [route, snapshot] = await Promise.all([
      this.repository.findRoute(organizationId, routeId),
      this.loadSnapshot(organizationId),
    ]);
    if (!route) throw new NotFoundException('Route not found');
    const trips = this.filter(this.evaluate(snapshot.trips), query).filter(
      (item) => item.source.routeId === routeId,
    );
    return {
      routeId,
      routeLabel: this.routeLabel(route, snapshot),
      ...this.makeSeries(routeId, this.routeLabel(route, snapshot), trips),
    };
  }

  async getRouteCommodities(
    organizationId: string,
    routeId: string,
    query: SeasonalityFilterQueryDto = {},
  ) {
    const [route, snapshot] = await Promise.all([
      this.repository.findRoute(organizationId, routeId),
      this.loadSnapshot(organizationId),
    ]);
    if (!route) throw new NotFoundException('Route not found');
    const trips = this.filter(this.evaluate(snapshot.trips), query).filter(
      (item) => item.source.routeId === routeId,
    );
    const data = this.routeCommoditySeries(snapshot, trips);
    return {
      routeId,
      routeLabel: this.routeLabel(route, snapshot),
      sampleSize: trips.length,
      sufficientData: trips.length >= THRESHOLDS.minimumTrips,
      explanation: this.thresholdExplanation(),
      data,
    };
  }

  async getCustomer(
    organizationId: string,
    customerId: string,
    query: SeasonalityFilterQueryDto = {},
  ) {
    const [entity, snapshot] = await Promise.all([
      this.repository.findCustomer(organizationId, customerId),
      this.loadSnapshot(organizationId),
    ]);
    if (!entity) throw new NotFoundException('Customer not found');
    const trips = this.filter(this.evaluate(snapshot.trips), query).filter(
      (item) => item.source.customerId === customerId,
    );
    const series = this.makeSeries(customerId, entity.name, trips);
    const relatedCommodities = this.relatedPatterns(
      this.group(trips, (item) =>
        item.source.commodityId &&
        snapshot.commodities.some((row) => row.id === item.source.commodityId)
          ? {
              key: item.source.commodityId,
              label: snapshot.commodities.find((row) => row.id === item.source.commodityId)!.name,
            }
          : null,
      ),
    );
    const relatedRoutes = this.relatedPatterns(
      this.group(trips, (item) =>
        item.source.routeId && snapshot.routes.some((row) => row.id === item.source.routeId)
          ? {
              key: item.source.routeId,
              label: this.routeLabel(
                snapshot.routes.find((row) => row.id === item.source.routeId)!,
                snapshot,
              ),
            }
          : null,
      ),
    );
    return { ...series, relatedCommodities, relatedRoutes };
  }

  async compare(
    organizationId: string,
    query: SeasonalityComparisonQueryDto,
  ): Promise<SeasonalityComparison> {
    const snapshot = await this.loadSnapshot(organizationId);
    const all = this.filter(this.evaluate(snapshot.trips), {
      year: query.year,
      startMonth: query.startMonth,
      endMonth: query.endMonth,
    });
    const fleetSeries = this.makeSeries('fleet', 'Fleet', all);
    let entityId: string;
    let label: string;
    let selected: Evaluated[];
    if (query.entityType === 'commodity') {
      if (!query.commodityId || query.routeId || query.customerId)
        throw new BadRequestException('Commodity comparison requires only commodityId');
      const row = query.commodityId
        ? await this.repository.findCommodity(organizationId, query.commodityId)
        : null;
      if (!row) throw new NotFoundException('Commodity not found');
      entityId = row.id;
      label = row.name;
      selected = all.filter((item) => item.source.commodityId === row.id);
    } else if (query.entityType === 'customer') {
      if (!query.customerId || query.routeId || query.commodityId)
        throw new BadRequestException('Customer comparison requires only customerId');
      const row = query.customerId
        ? await this.repository.findCustomer(organizationId, query.customerId)
        : null;
      if (!row) throw new NotFoundException('Customer not found');
      entityId = row.id;
      label = row.name;
      selected = all.filter((item) => item.source.customerId === row.id);
    } else {
      if (!query.routeId || !query.commodityId || query.customerId)
        throw new BadRequestException(
          'Route/commodity comparison requires routeId and commodityId',
        );
      const route = query.routeId
        ? await this.repository.findRoute(organizationId, query.routeId)
        : null;
      const commodity = query.commodityId
        ? await this.repository.findCommodity(organizationId, query.commodityId)
        : null;
      if (!route || !commodity) throw new NotFoundException('Route or commodity not found');
      entityId = `${route.id}:${commodity.id}`;
      label = `${this.routeLabel(route, snapshot)} · ${commodity.name}`;
      selected = all.filter(
        (item) => item.source.routeId === route.id && item.source.commodityId === commodity.id,
      );
    }
    const series = this.makeSeries(entityId, label, selected);
    const field = query.metric;
    const fleetByMonth = new Map(fleetSeries.monthlyPatterns.map((item) => [item.month, item]));
    const data = series.monthlyPatterns.map((item) => ({
      month: item.month,
      monthLabel: item.monthLabel,
      entityValue: this.metric(item, field),
      fleetValue: this.metric(fleetByMonth.get(item.month), field),
      sampleSize: item.tripCount,
    }));
    return {
      entityType: query.entityType,
      entityId,
      metric: field,
      sufficientData: series.sufficientData,
      explanation: series.sufficientData
        ? `${label} is compared with fleet history for the same calendar months. Values are historical descriptions across ${series.historicalTripCount} trips, not forecasts.`
        : `Insufficient history to compare ${label}; ${series.explanation}`,
      data,
    };
  }

  private async loadSnapshot(organizationId: string): Promise<Snapshot> {
    const [
      trips,
      commodities,
      customers,
      routes,
      locations,
      unlinkedExpenses,
      unlinkedFuelTransactions,
    ] = await Promise.all([
      this.repository.findCompletedTrips(organizationId),
      this.repository.findCommodities(organizationId),
      this.repository.findCustomers(organizationId),
      this.repository.findRoutes(organizationId),
      this.repository.findLocations(organizationId),
      this.repository.findUnlinkedExpenses(organizationId),
      this.repository.findUnlinkedFuelTransactions(organizationId),
    ]);
    return {
      trips,
      commodities,
      customers,
      routes,
      locations,
      unlinkedExpenses,
      unlinkedFuelTransactions,
    };
  }

  private evaluate(trips: Trip[]): Evaluated[] {
    return trips.map((trip) => {
      const revenueValue = trip.actualFreight ?? trip.estimatedFreight;
      const revenue = revenueValue === null ? null : ProfitabilityUtil.toNumber(revenueValue);
      const expenses = ProfitabilityUtil.calculateTotalCost(
        ProfitabilityUtil.buildExpensesFromRecords(trip.expenses, trip.fuelTransactions),
      );
      const profit = revenue === null ? null : this.round2(revenue - expenses);
      const distanceValue = trip.actualDistanceKm ?? trip.estimatedDistanceKm;
      const distance =
        distanceValue === null || ProfitabilityUtil.toNumber(distanceValue) <= 0
          ? null
          : ProfitabilityUtil.toNumber(distanceValue);
      const month = trip.startDate.getUTCMonth() + 1;
      return {
        source: trip,
        year: trip.startDate.getUTCFullYear(),
        month,
        revenue,
        expenses: this.round2(expenses),
        profit,
        margin:
          revenue !== null && revenue > 0 && profit !== null
            ? this.round2((profit / revenue) * 100)
            : null,
        distance,
        cashReceived: PaymentCollectionUtil.calculate(revenueValue, trip.payments).received,
      };
    });
  }

  private filter(trips: Evaluated[], query: SeasonalityFilterQueryDto): Evaluated[] {
    return trips.filter(({ source, year, month }) => {
      if (query.year !== undefined && query.year !== year) return false;
      if (query.commodityId && source.commodityId !== query.commodityId) return false;
      if (query.routeId && source.routeId !== query.routeId) return false;
      if (query.customerId && source.customerId !== query.customerId) return false;
      if (query.startMonth !== undefined && query.endMonth !== undefined) {
        if (
          query.startMonth <= query.endMonth &&
          (month < query.startMonth || month > query.endMonth)
        )
          return false;
        if (query.startMonth > query.endMonth && month < query.startMonth && month > query.endMonth)
          return false;
      } else if (query.startMonth !== undefined && month < query.startMonth) return false;
      else if (query.endMonth !== undefined && month > query.endMonth) return false;
      return true;
    });
  }

  private monthlyActivity(
    trips: Evaluated[],
    additionalCosts: Array<{ date: Date; amount: number }>,
  ): SeasonalityMonthlyActivity[] {
    const groups = new Map<
      string,
      { year: number; month: number; trips: Evaluated[]; extraCost: number }
    >();
    for (const item of trips) {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      const group = groups.get(key) ?? {
        year: item.year,
        month: item.month,
        trips: [],
        extraCost: 0,
      };
      group.trips.push(item);
      groups.set(key, group);
    }
    for (const item of additionalCosts) {
      const year = item.date.getUTCFullYear();
      const month = item.date.getUTCMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const group = groups.get(key) ?? { year, month, trips: [], extraCost: 0 };
      group.extraCost += item.amount;
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((group) => ({
        year: group.year,
        month: group.month,
        monthLabel: this.monthLabel(group.month),
        ...this.metrics(group.trips, group.extraCost),
      }));
  }

  private commoditySeries(snapshot: Snapshot, trips: Evaluated[]) {
    const items = this.group(trips, (item) => {
      const row = item.source.commodityId
        ? snapshot.commodities.find((commodity) => commodity.id === item.source.commodityId)
        : null;
      return row ? { key: row.id, label: row.name } : null;
    });
    return items.map((item) => this.makeSeries(item.key, item.label, item.trips));
  }

  private routeCommoditySeries(snapshot: Snapshot, trips: Evaluated[]) {
    const groups = new Map<
      string,
      {
        routeId: string;
        commodityId: string;
        routeLabel: string;
        commodityName: string;
        trips: Evaluated[];
      }
    >();
    const validRouteIds = new Set(snapshot.routes.map((item) => item.id));
    const commodities = new Map(snapshot.commodities.map((item) => [item.id, item.name]));
    for (const trip of trips) {
      const routeId = trip.source.routeId;
      const commodityId = trip.source.commodityId;
      if (!routeId || !commodityId || !validRouteIds.has(routeId) || !commodities.has(commodityId))
        continue;
      const key = `${routeId}:${commodityId}`;
      const route = snapshot.routes.find((item) => item.id === routeId)!;
      const group = groups.get(key) ?? {
        routeId,
        commodityId,
        routeLabel: this.routeLabel(route, snapshot),
        commodityName: commodities.get(commodityId)!,
        trips: [],
      };
      group.trips.push(trip);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => ({
      ...this.makeSeries(key, `${group.routeLabel} · ${group.commodityName}`, group.trips),
      routeId: group.routeId,
      routeLabel: group.routeLabel,
      commodityId: group.commodityId,
      commodityName: group.commodityName,
    }));
  }

  private customerSeries(snapshot: Snapshot, trips: Evaluated[]) {
    const grouped = this.group(trips, (item) => {
      const row = item.source.customerId
        ? snapshot.customers.find((customer) => customer.id === item.source.customerId)
        : null;
      return row ? { key: row.id, label: row.name } : null;
    });
    return grouped.map((item) => {
      const relatedCommodities = this.relatedPatterns(
        this.group(item.trips, (trip) => {
          const row = trip.source.commodityId
            ? snapshot.commodities.find((commodity) => commodity.id === trip.source.commodityId)
            : null;
          return row ? { key: row.id, label: row.name } : null;
        }),
      );
      const relatedRoutes = this.relatedPatterns(
        this.group(item.trips, (trip) => {
          const row = trip.source.routeId
            ? snapshot.routes.find((route) => route.id === trip.source.routeId)
            : null;
          return row ? { key: row.id, label: this.routeLabel(row, snapshot) } : null;
        }),
      );
      return {
        ...this.makeSeries(item.key, item.label, item.trips),
        relatedCommodities,
        relatedRoutes,
      };
    });
  }

  private makeSeries(id: string, label: string, trips: Evaluated[]): SeasonalityEntity {
    const months = new Map<number, Evaluated[]>();
    for (const item of trips) months.set(item.month, [...(months.get(item.month) ?? []), item]);
    const monthlyPatterns = [...months.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, rows]) => ({
        month,
        monthLabel: this.monthLabel(month),
        yearsObserved: new Set(rows.map((item) => item.year)).size,
        ...this.metrics(rows),
      }));
    const yearsObserved = new Set(trips.map((item) => item.year)).size;
    const observedMonths = new Set(trips.map((item) => `${item.year}-${item.month}`)).size;
    const monthOfYearCount = months.size;
    const sufficientData =
      trips.length >= THRESHOLDS.minimumTrips &&
      yearsObserved >= THRESHOLDS.minimumYears &&
      monthOfYearCount >= THRESHOLDS.minimumMonthOfYearValues;
    const strength = this.strength(trips, monthlyPatterns, sufficientData);
    const candidates = monthlyPatterns.filter(
      (item) => item.tripCount >= THRESHOLDS.minimumMonthSampleTrips,
    );
    const volumeSort = [...candidates].sort((a, b) => b.tripCount - a.tripCount);
    const profitCandidates = candidates.filter((item) => item.averageProfitPerTrip !== null);
    const profitSort = [...profitCandidates].sort(
      (a, b) => (b.averageProfitPerTrip ?? -Infinity) - (a.averageProfitPerTrip ?? -Infinity),
    );
    const yearOverYear = this.yearOverYear(trips);
    const insights: string[] = [];
    if (sufficientData && volumeSort.length > 0)
      insights.push(
        `${label} historically had its highest trip volume in ${volumeSort[0].monthLabel} across ${volumeSort[0].yearsObserved} observed years (${volumeSort[0].tripCount} trips).`,
      );
    if (sufficientData && profitSort.length > 0)
      insights.push(
        `${label} historically had its highest average profit/trip in ${profitSort[0].monthLabel} across ${profitSort[0].yearsObserved} observed years (${profitSort[0].tripCount} trips).`,
      );
    const recentYoY = yearOverYear.at(-1);
    if (sufficientData && recentYoY?.tripCountChangePct !== null && recentYoY)
      insights.push(
        `${label}: ${recentYoY.monthLabel} trip volume changed ${recentYoY.tripCountChangePct}% from ${recentYoY.previousYear} to ${recentYoY.year} (${recentYoY.explanation}).`,
      );
    const explanation = sufficientData
      ? `${trips.length} historical trips across ${observedMonths} observed year-months, ${monthOfYearCount} calendar months and ${yearsObserved} years. ${this.strengthExplanation(strength)} ${this.thresholdExplanation()} Profit and cost/km use trip-linked costs; fleet-level costs without trip links are not assigned to commodity, route or customer patterns.`
      : `Insufficient data for a seasonality pattern: ${trips.length} trips, ${observedMonths} observed year-months, ${monthOfYearCount} calendar months and ${yearsObserved} years. Require at least ${THRESHOLDS.minimumTrips} trips, ${THRESHOLDS.minimumYears} years and ${THRESHOLDS.minimumMonthOfYearValues} calendar months. Profit and cost/km use trip-linked costs.`;
    return {
      id,
      label,
      historicalTripCount: trips.length,
      observedMonths,
      monthOfYearCount,
      yearsObserved,
      sufficientData,
      strength,
      explanation,
      strongestVolumeMonth: sufficientData ? (volumeSort[0]?.month ?? null) : null,
      weakestVolumeMonth: sufficientData
        ? volumeSort.length > 1
          ? volumeSort.at(-1)!.month
          : null
        : null,
      strongestProfitMonth: sufficientData ? (profitSort[0]?.month ?? null) : null,
      weakestProfitMonth: sufficientData
        ? profitSort.length > 1
          ? profitSort.at(-1)!.month
          : null
        : null,
      monthlyPatterns,
      yearOverYear,
      yearOverYearExplanation: yearOverYear.length
        ? 'Year-over-year comparison is available for months with records in consecutive years.'
        : 'Year-over-year comparison unavailable: records do not span consecutive years for the same month.',
      insights,
    };
  }

  private metrics(trips: Evaluated[], additionalExpenses = 0): SeasonalityMetrics {
    const tripCount = trips.length;
    const completeRevenue = tripCount > 0 && trips.every((item) => item.revenue !== null);
    const revenue = completeRevenue ? this.sum(trips.map((item) => item.revenue ?? 0)) : null;
    const expenses = this.round2(this.sum(trips.map((item) => item.expenses)) + additionalExpenses);
    const profit = revenue === null ? null : this.round2(revenue - expenses);
    const distanceTrips = trips.filter((item) => item.distance !== null);
    const distance = this.sum(distanceTrips.map((item) => item.distance ?? 0));
    const distanceCosts = this.sum(distanceTrips.map((item) => item.expenses));
    return {
      tripCount,
      revenue,
      cashReceived: this.sum(trips.map((item) => item.cashReceived)),
      expenses,
      profit,
      averageFreight: revenue === null || !tripCount ? null : this.round2(revenue / tripCount),
      averageProfitPerTrip: profit === null || !tripCount ? null : this.round2(profit / tripCount),
      averageMarginPct:
        revenue !== null && revenue > 0 && profit !== null
          ? this.round2((profit / revenue) * 100)
          : null,
      averageCostPerKm: distance > 0 ? this.round2(distanceCosts / distance) : null,
      distanceSampleSize: distanceTrips.length,
    };
  }

  private yearOverYear(trips: Evaluated[]): SeasonalityYearOverYear[] {
    const years = [...new Set(trips.map((item) => item.year))].sort((a, b) => a - b);
    if (years.length < 2) return [];
    const output: SeasonalityYearOverYear[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const byYear = new Map<number, Evaluated[]>();
      for (const item of trips.filter((trip) => trip.month === month))
        byYear.set(item.year, [...(byYear.get(item.year) ?? []), item]);
      for (const year of years) {
        const currentRows = byYear.get(year);
        const previousRows = byYear.get(year - 1);
        if (!currentRows || !previousRows) continue;
        const current = this.metrics(currentRows);
        const previous = this.metrics(previousRows);
        output.push({
          month,
          monthLabel: this.monthLabel(month),
          year,
          previousYear: year - 1,
          tripCountChangePct: this.changePct(current.tripCount, previous.tripCount),
          revenueChangePct:
            current.revenue === null || previous.revenue === null
              ? null
              : this.changePct(current.revenue, previous.revenue),
          profitChangePct:
            current.profit === null || previous.profit === null
              ? null
              : this.changePct(current.profit, previous.profit),
          marginChangePoints:
            current.averageMarginPct === null || previous.averageMarginPct === null
              ? null
              : this.round2(current.averageMarginPct - previous.averageMarginPct),
          explanation: `${current.tripCount} trips in ${year} compared with ${previous.tripCount} trips in ${year - 1}.`,
        });
      }
    }
    return output.sort((a, b) => a.year - b.year || a.month - b.month);
  }

  private strength(
    trips: Evaluated[],
    patterns: SeasonalityEntity['monthlyPatterns'],
    sufficient: boolean,
  ): SeasonalityStrength {
    if (!sufficient || !trips.length) return 'INSUFFICIENT_DATA';
    const peakShare = Math.max(...patterns.map((item) => item.tripCount)) / trips.length;
    if (peakShare >= THRESHOLDS.strongPeakShare) return 'STRONG_PATTERN';
    if (peakShare >= THRESHOLDS.moderatePeakShare) return 'MODERATE_PATTERN';
    return 'WEAK_PATTERN';
  }

  private group(
    trips: Evaluated[],
    keyOf: (trip: Evaluated) => { key: string; label: string } | null,
  ): GroupedTrip[] {
    const groups = new Map<string, { label: string; trips: Evaluated[] }>();
    for (const trip of trips) {
      const key = keyOf(trip);
      if (!key) continue;
      const value = groups.get(key.key) ?? { label: key.label, trips: [] };
      value.trips.push(trip);
      groups.set(key.key, value);
    }
    return [...groups.entries()].map(([key, value]) => ({
      key,
      label: value.label,
      trips: value.trips,
    }));
  }

  private relatedPatterns(groups: GroupedTrip[]): SeasonalityRelatedPattern[] {
    return groups.map(({ key, label, trips }) => {
      const metrics = this.metrics(trips);
      return {
        id: key,
        label,
        tripCount: metrics.tripCount,
        revenue: metrics.revenue,
        profit: metrics.profit,
        marginPct: metrics.averageMarginPct,
        averageFreight: metrics.averageFreight,
      };
    });
  }

  private routeLabel(route: Snapshot['routes'][number], snapshot: Snapshot) {
    const labels = new Map(
      snapshot.locations.map((item) => [
        item.id,
        item.name || item.city || item.state || 'Unknown',
      ]),
    );
    return `${labels.get(route.originLocationId) ?? 'Unknown'} → ${labels.get(route.destinationLocationId) ?? 'Unknown'}`;
  }

  private metric(
    item: SeasonalityMetrics | undefined,
    metric: SeasonalityComparison['metric'],
  ): number | null {
    if (!item) return null;
    if (metric === 'tripCount') return item.tripCount;
    if (metric === 'averageProfitPerTrip') return item.averageProfitPerTrip;
    return item.averageMarginPct;
  }

  private strengthExplanation(strength: SeasonalityStrength) {
    if (strength === 'STRONG_PATTERN')
      return `Strong pattern: the busiest observed calendar month accounts for at least ${THRESHOLDS.strongPeakShare * 100}% of trips.`;
    if (strength === 'MODERATE_PATTERN')
      return `Moderate pattern: the busiest observed calendar month accounts for at least ${THRESHOLDS.moderatePeakShare * 100}% of trips.`;
    return 'Weak pattern: no observed calendar month reaches the moderate trip-share threshold.';
  }
  private thresholdExplanation() {
    return `Pattern strength requires at least ${THRESHOLDS.minimumTrips} trips, ${THRESHOLDS.minimumYears} years and ${THRESHOLDS.minimumMonthOfYearValues} observed calendar months. Peak/low month comparisons require at least ${THRESHOLDS.minimumMonthSampleTrips} trips in a month. This deterministic classification is not statistical confidence or a forecast.`;
  }
  private monthLabel(month: number) {
    return MONTHS[month - 1] ?? 'Unknown';
  }
  private matchesDate(date: Date, query: SeasonalityFilterQueryDto) {
    const month = date.getUTCMonth() + 1;
    if (query.year !== undefined && query.year !== date.getUTCFullYear()) return false;
    if (query.startMonth !== undefined && query.endMonth !== undefined) {
      if (
        query.startMonth <= query.endMonth &&
        (month < query.startMonth || month > query.endMonth)
      )
        return false;
      if (query.startMonth > query.endMonth && month < query.startMonth && month > query.endMonth)
        return false;
    } else if (query.startMonth !== undefined && month < query.startMonth) return false;
    else if (query.endMonth !== undefined && month > query.endMonth) return false;
    return true;
  }
  private changePct(current: number, previous: number) {
    return previous === 0 ? null : this.round2(((current - previous) / Math.abs(previous)) * 100);
  }
  private sum(values: number[]) {
    return this.round2(values.reduce((sum, value) => sum + value, 0));
  }
  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
