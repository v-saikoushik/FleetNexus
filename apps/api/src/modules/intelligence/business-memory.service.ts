import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type BusinessMemoryConfidence,
  type BusinessMemoryFreightRate,
  type BusinessMemoryFreightHistory,
  type BusinessMemoryHistoryEntry,
  type BusinessMemoryEntityHistory,
  type BusinessMemoryOverview,
  type BusinessMemorySimilarTrips,
  type BusinessMemoryTrip,
  BUSINESS_MEMORY_SAMPLE_THRESHOLDS,
  LOAD_PROFITABILITY_THRESHOLDS,
} from '@fleetnexus/shared';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
import { ProfitabilityUtil } from './profitability/profitability.util';
import { BusinessMemoryRepository } from './business-memory.repository';
import type { HistoricalSimilarTripsQueryDto } from './dto/historical-similar-trips-query.dto';

type MemoryTrip = Awaited<ReturnType<BusinessMemoryRepository['findCompletedTrips']>>[number];
type FreightRate = Awaited<ReturnType<BusinessMemoryRepository['findFreightRates']>>[number];
type Snapshot = {
  trips: MemoryTrip[];
  vehicles: Awaited<ReturnType<BusinessMemoryRepository['findVehicles']>>;
  customers: Awaited<ReturnType<BusinessMemoryRepository['findCustomers']>>;
  commodities: Awaited<ReturnType<BusinessMemoryRepository['findCommodities']>>;
  routes: Awaited<ReturnType<BusinessMemoryRepository['findRoutes']>>;
  locations: Awaited<ReturnType<BusinessMemoryRepository['findLocations']>>;
  rates: FreightRate[];
};
type EvaluatedTrip = {
  source: MemoryTrip;
  report: BusinessMemoryTrip;
  routeKey: string;
  commodityKey: string | null;
  customerKey: string | null;
};

@Injectable()
export class BusinessMemoryService {
  constructor(private readonly memory: BusinessMemoryRepository) {}

  async getOverview(organizationId: string): Promise<BusinessMemoryOverview> {
    const snapshot = await this.loadSnapshot(organizationId);
    const evaluated = this.evaluateTrips(snapshot);
    const pricedTripCount = evaluated.filter(({ report }) => report.revenue !== null).length;
    const confidence = this.confidence(evaluated.length);
    const explanation = this.sampleExplanation(evaluated.length, 'completed trips');
    return {
      sampleSize: evaluated.length,
      pricedTripCount,
      confidence,
      explanation,
      customers: this.aggregate(
        evaluated,
        (item) => item.customerKey,
        (item) =>
          item.customerKey
            ? (snapshot.customers.find((row) => row.id === item.customerKey)?.name ?? 'Customer')
            : null,
      ),
      routes: this.aggregate(
        evaluated,
        (item) => item.routeKey,
        (item) => item.report.routeLabel,
      ),
      commodities: this.aggregate(
        evaluated,
        (item) => item.commodityKey,
        (item) =>
          item.commodityKey
            ? (snapshot.commodities.find((row) => row.id === item.commodityKey)?.name ??
              'Commodity')
            : null,
      ),
      vehicles: this.aggregate(
        evaluated,
        (item) => item.source.vehicleId,
        (item) =>
          snapshot.vehicles.find((row) => row.id === item.source.vehicleId)?.registrationNumber ??
          'Vehicle',
      ),
      freightRates: this.aggregateRates(snapshot),
      historicalTrips: evaluated.slice(0, 20).map(({ report }) => report),
    };
  }

  async getSimilarTrips(
    organizationId: string,
    referenceTripId: string,
    limit = 10,
  ): Promise<BusinessMemorySimilarTrips> {
    const reference = await this.memory.findTripById(organizationId, referenceTripId);
    if (!reference) throw new NotFoundException('Completed trip not found');
    const snapshot = await this.loadSnapshot(organizationId);
    const evaluated = this.evaluateTrips(snapshot);
    const referenceReport = evaluated.find(({ source }) => source.id === referenceTripId)?.report;
    const matches = evaluated
      .filter(({ source }) => source.id !== referenceTripId)
      .map(({ source, report }) => {
        const reasons: string[] = [];
        if (reference.routeId && source.routeId === reference.routeId)
          reasons.push('Same saved route');
        if (
          !reference.routeId &&
          referenceReport &&
          this.normalize(report.origin) === this.normalize(referenceReport.origin) &&
          this.normalize(report.destination) === this.normalize(referenceReport.destination)
        )
          reasons.push('Same origin and destination');
        if (reference.commodityId && source.commodityId === reference.commodityId)
          reasons.push('Same commodity');
        if (reference.customerId && source.customerId === reference.customerId)
          reasons.push('Same customer');
        if (source.vehicleId === reference.vehicleId) reasons.push('Same vehicle');
        return { report, reasons, score: reasons.length };
      })
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || right.report.startDate.localeCompare(left.report.startDate),
      );
    const reports = matches.slice(0, limit);
    return {
      referenceTripId,
      sampleSize: matches.length,
      confidence: this.confidence(matches.length),
      explanation: matches.length
        ? `${this.sampleExplanation(matches.length, 'comparable completed trips')} Matched by saved route, commodity, customer, or vehicle. This is historical comparison, not a prediction.`
        : 'No completed trips matched the selected trip by saved route, commodity, customer, or vehicle.',
      data: reports.map(({ report, reasons }) => ({ ...report, similarityReasons: reasons })),
    };
  }

  async getSimilarTripsByCriteria(
    organizationId: string,
    query: HistoricalSimilarTripsQueryDto,
  ): Promise<BusinessMemorySimilarTrips> {
    if (query.tripId) return this.getSimilarTrips(organizationId, query.tripId, query.limit);
    const criteria = [
      query.customerId,
      query.routeId,
      query.commodityId,
      query.vehicleId,
      query.origin,
      query.destination,
      query.vehicleType,
      query.capacityTons,
    ].filter((value) => value !== undefined && value !== '');
    if (!criteria.length)
      throw new BadRequestException('Provide a tripId or at least one similarity field');
    const [customer, route, commodity, vehicle] = await Promise.all([
      query.customerId
        ? this.memory.findCustomerForOrganization(organizationId, query.customerId)
        : Promise.resolve(null),
      query.routeId
        ? this.memory.findRouteForOrganization(organizationId, query.routeId)
        : Promise.resolve(null),
      query.commodityId
        ? this.memory.findCommodityForOrganization(organizationId, query.commodityId)
        : Promise.resolve(null),
      query.vehicleId
        ? this.memory.findVehicleForOrganization(organizationId, query.vehicleId)
        : Promise.resolve(null),
    ]);
    if (
      (query.customerId && !customer) ||
      (query.routeId && !route) ||
      (query.commodityId && !commodity) ||
      (query.vehicleId && !vehicle)
    )
      throw new NotFoundException('Similarity reference not found');
    const snapshot = await this.loadSnapshot(organizationId);
    const matches = this.evaluateTrips(snapshot)
      .map(({ source, report }) => {
        const reasons: string[] = [];
        if (query.customerId && source.customerId === query.customerId)
          reasons.push('Same customer');
        if (query.routeId && source.routeId === query.routeId) reasons.push('Same route');
        if (query.commodityId && source.commodityId === query.commodityId)
          reasons.push('Same commodity');
        if (query.vehicleId && source.vehicleId === query.vehicleId) reasons.push('Same vehicle');
        if (query.origin && this.normalize(report.origin) === this.normalize(query.origin))
          reasons.push('Same origin');
        if (
          query.destination &&
          this.normalize(report.destination) === this.normalize(query.destination)
        )
          reasons.push('Same destination');
        const tripVehicle = snapshot.vehicles.find((item) => item.id === source.vehicleId);
        if (query.vehicleType && tripVehicle?.vehicleType === query.vehicleType)
          reasons.push('Same vehicle type');
        if (
          query.capacityTons !== undefined &&
          tripVehicle &&
          Math.abs(ProfitabilityUtil.toNumber(tripVehicle.capacityTons) - query.capacityTons) <= 2
        )
          reasons.push('Similar vehicle capacity (within 2 tons)');
        const matches = reasons.length === criteria.length;
        return { report, reasons, matches };
      })
      .filter((item) => item.matches);
    const reports = matches.slice(0, query.limit);
    return {
      referenceTripId: query.tripId ?? '',
      sampleSize: matches.length,
      confidence: this.confidence(matches.length),
      explanation: matches.length
        ? `${this.sampleExplanation(matches.length, 'comparable historical trips')} Matching all requested fields (${matches[0].reasons.join(' + ')}). This is deterministic historical comparison, not a prediction.`
        : 'Insufficient historical data. No completed trips matched all supplied similarity fields.',
      data: reports.map(({ report, reasons }) => ({ ...report, similarityReasons: reasons })),
    };
  }

  async getLoadComparables(
    organizationId: string,
    criteria: {
      customerId?: string;
      routeId: string;
      commodityId: string;
      vehicleId?: string;
      distanceKm?: number;
      loadWeightTons?: number;
      proposedDate: Date;
    },
  ) {
    const [customer, route, commodity, vehicle] = await Promise.all([
      criteria.customerId
        ? this.memory.findCustomerForOrganization(organizationId, criteria.customerId)
        : Promise.resolve(null),
      this.memory.findRouteForOrganization(organizationId, criteria.routeId),
      this.memory.findCommodityForOrganization(organizationId, criteria.commodityId),
      criteria.vehicleId
        ? this.memory.findVehicleForOrganization(organizationId, criteria.vehicleId)
        : Promise.resolve(null),
    ]);
    if (
      !route ||
      !commodity ||
      (criteria.customerId && !customer) ||
      (criteria.vehicleId && !vehicle)
    ) {
      throw new NotFoundException(
        'One or more proposed-load references were not found in this organization',
      );
    }
    if (
      vehicle &&
      criteria.loadWeightTons !== undefined &&
      criteria.loadWeightTons > ProfitabilityUtil.toNumber(vehicle.capacityTons)
    ) {
      throw new BadRequestException(
        `Load weight exceeds the selected vehicle capacity of ${ProfitabilityUtil.toNumber(vehicle.capacityTons)} tons`,
      );
    }

    const snapshot = await this.loadSnapshot(organizationId);
    const selectedVehicle = criteria.vehicleId
      ? snapshot.vehicles.find((item) => item.id === criteria.vehicleId)
      : undefined;
    const dateDistance =
      criteria.distanceKm ??
      (route.estimatedDistance === null
        ? undefined
        : ProfitabilityUtil.toNumber(route.estimatedDistance));
    const quarter = Math.floor(criteria.proposedDate.getUTCMonth() / 3);
    const matches = this.evaluateTrips(snapshot)
      .filter(
        ({ source }) =>
          source.routeId === criteria.routeId && source.commodityId === criteria.commodityId,
      )
      .map(({ source, report }) => {
        const reasons = ['Same route', 'Same commodity'];
        if (criteria.customerId && source.customerId === criteria.customerId)
          reasons.push('Same customer');
        const historicalVehicle = snapshot.vehicles.find((item) => item.id === source.vehicleId);
        if (criteria.vehicleId && source.vehicleId === criteria.vehicleId)
          reasons.push('Same vehicle');
        else if (
          selectedVehicle &&
          historicalVehicle?.vehicleType === selectedVehicle.vehicleType
        ) {
          reasons.push('Same vehicle type');
          if (
            Math.abs(
              ProfitabilityUtil.toNumber(historicalVehicle.capacityTons) -
                ProfitabilityUtil.toNumber(selectedVehicle.capacityTons),
            ) <= LOAD_PROFITABILITY_THRESHOLDS.similarCapacityToleranceTons
          )
            reasons.push('Similar vehicle capacity');
        }
        if (dateDistance && report.distanceKm) {
          const tolerance = Math.max(
            LOAD_PROFITABILITY_THRESHOLDS.similarDistanceFloorKm,
            dateDistance * LOAD_PROFITABILITY_THRESHOLDS.similarDistanceFraction,
          );
          if (Math.abs(report.distanceKm - dateDistance) <= tolerance)
            reasons.push('Similar distance');
        }
        if (Math.floor(source.startDate.getUTCMonth() / 3) === quarter)
          reasons.push('Same calendar quarter');
        const fuelLitres = source.fuelTransactions.reduce(
          (sum, item) => sum + ProfitabilityUtil.toNumber(item.litres),
          0,
        );
        const fuelPurchaseAmount = source.fuelTransactions.reduce(
          (sum, item) => sum + ProfitabilityUtil.toNumber(item.totalAmount),
          0,
        );
        const costBreakdown = ProfitabilityUtil.buildExpensesFromRecords(
          source.expenses,
          source.fuelTransactions,
        );
        return {
          tripId: source.id,
          tripNumber: source.tripNumber,
          date: report.startDate,
          routeLabel: report.routeLabel,
          commodityName: report.commodityName,
          customerName: report.customerName,
          customerId: source.customerId,
          vehicleRegistrationNumber: report.vehicleRegistrationNumber,
          vehicleId: source.vehicleId,
          vehicleType: historicalVehicle?.vehicleType ?? null,
          vehicleCapacityTons: historicalVehicle
            ? ProfitabilityUtil.toNumber(historicalVehicle.capacityTons)
            : null,
          revenue: report.revenue,
          revenueBasis:
            source.actualFreight !== null
              ? 'ACTUAL'
              : source.estimatedFreight !== null
                ? 'ESTIMATED'
                : null,
          totalCost: report.totalCost,
          profit: report.profit,
          marginPct: report.marginPct,
          distanceKm: report.distanceKm,
          costBreakdown,
          componentValues: {
            fuel: costBreakdown.fuelCost,
            toll: costBreakdown.tollCost,
            driver: costBreakdown.driverCost,
            loadingUnloading: source.expenses
              .filter((item) => ['LOADING', 'UNLOADING'].includes(item.type))
              .reduce((sum, item) => sum + ProfitabilityUtil.toNumber(item.amount), 0),
            maintenance: costBreakdown.maintenanceAllocation,
            other: source.expenses
              .filter(
                (item) =>
                  ![
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
                  ].includes(item.type),
              )
              .reduce((sum, item) => sum + ProfitabilityUtil.toNumber(item.amount), 0),
          },
          componentEvidence: {
            fuel:
              source.expenses.some((item) => item.type === 'FUEL') ||
              source.fuelTransactions.length > 0,
            toll: source.expenses.some((item) => item.type === 'TOLL'),
            driver: source.expenses.some((item) =>
              ['DRIVER_ALLOWANCE', 'DRIVER_SALARY', 'FOOD_ALLOWANCE'].includes(item.type),
            ),
            loadingUnloading: source.expenses.some((item) =>
              ['LOADING', 'UNLOADING'].includes(item.type),
            ),
            maintenance: source.expenses.some((item) =>
              ['MAINTENANCE', 'REPAIRS', 'TYRES'].includes(item.type),
            ),
            other: source.expenses.some(
              (item) =>
                ![
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
                ].includes(item.type),
            ),
          },
          fuelLitres,
          fuelPurchaseAmount,
          similarityReasons: reasons,
          similarityScore: reasons.length,
        };
      })
      .sort((a, b) => b.similarityScore - a.similarityScore || b.date.localeCompare(a.date));
    return {
      sampleSize: matches.length,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      route: {
        id: route.id,
        label: matches[0]?.routeLabel ?? this.routeLabel(snapshot, route),
        estimatedDistanceKm:
          route.estimatedDistance === null
            ? null
            : ProfitabilityUtil.toNumber(route.estimatedDistance),
      },
      commodity: { id: commodity.id, name: commodity.name },
      vehicle: vehicle
        ? {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            vehicleType: vehicle.vehicleType,
            capacityTons: ProfitabilityUtil.toNumber(vehicle.capacityTons),
          }
        : null,
      trips: matches,
      explanation: matches.length
        ? `Found ${matches.length} completed trips with the same route and commodity. Results are ranked by customer, vehicle, distance, season, and recency; each match lists its reasons.`
        : 'No completed trips matched the proposed route and commodity.',
    };
  }

  async getCustomerHistory(
    organizationId: string,
    customerId: string,
  ): Promise<BusinessMemoryEntityHistory> {
    const customer = await this.memory.findCustomerForOrganization(organizationId, customerId);
    if (!customer) throw new NotFoundException('Customer history not found');
    const snapshot = await this.loadSnapshot(organizationId);
    return this.entityHistory(
      customer.id,
      customer.name,
      this.evaluateTrips(snapshot).filter((trip) => trip.customerKey === customerId),
      snapshot,
    );
  }

  async getRouteHistory(
    organizationId: string,
    routeId: string,
  ): Promise<BusinessMemoryEntityHistory> {
    const route = await this.memory.findRouteForOrganization(organizationId, routeId);
    if (!route) throw new NotFoundException('Route history not found');
    const snapshot = await this.loadSnapshot(organizationId);
    const report = this.evaluateTrips(snapshot).filter((trip) => trip.source.routeId === routeId);
    const history = this.entityHistory(
      route.id,
      report[0]?.report.routeLabel ?? this.routeLabel(snapshot, route),
      report,
      snapshot,
    );
    history.routes = [history.label];
    return history;
  }

  async getCommodityHistory(
    organizationId: string,
    commodityId: string,
  ): Promise<BusinessMemoryEntityHistory> {
    const commodity = await this.memory.findCommodityForOrganization(organizationId, commodityId);
    if (!commodity) throw new NotFoundException('Commodity history not found');
    const snapshot = await this.loadSnapshot(organizationId);
    return this.entityHistory(
      commodity.id,
      commodity.name,
      this.evaluateTrips(snapshot).filter((trip) => trip.commodityKey === commodityId),
      snapshot,
    );
  }

  async getVehicleHistory(
    organizationId: string,
    vehicleId: string,
  ): Promise<BusinessMemoryEntityHistory> {
    const vehicle = await this.memory.findVehicleForOrganization(organizationId, vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle history not found');
    const snapshot = await this.loadSnapshot(organizationId);
    return this.entityHistory(
      vehicle.id,
      vehicle.registrationNumber,
      this.evaluateTrips(snapshot).filter((trip) => trip.source.vehicleId === vehicleId),
      snapshot,
    );
  }

  async getFreightHistory(
    organizationId: string,
    routeId: string,
    commodityId: string,
    customerId?: string,
  ): Promise<BusinessMemoryFreightHistory> {
    const [route, commodity, customer] = await Promise.all([
      this.memory.findRouteForOrganization(organizationId, routeId),
      this.memory.findCommodityForOrganization(organizationId, commodityId),
      customerId
        ? this.memory.findCustomerForOrganization(organizationId, customerId)
        : Promise.resolve(null),
    ]);
    if (!route || !commodity || (customerId && !customer))
      throw new NotFoundException('Freight history reference not found');
    const snapshot = await this.loadSnapshot(organizationId);
    const trips = this.evaluateTrips(snapshot).filter(
      ({ source }) =>
        source.routeId === routeId &&
        source.commodityId === commodityId &&
        (!customerId || source.customerId === customerId),
    );
    const freight = trips
      .map(({ report }) => report.revenue)
      .filter((value): value is number => value !== null);
    const profits = trips
      .map(({ report }) => report.profit)
      .filter((value): value is number => value !== null);
    const margins = trips
      .map(({ report }) => report.marginPct)
      .filter((value): value is number => value !== null);
    const routeLabel = trips[0]?.report.routeLabel ?? this.routeLabel(snapshot, route);
    const confidence = this.confidence(trips.length);
    const baseExplanation = this.sampleExplanation(trips.length, 'comparable completed trips');
    return {
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      routeId,
      routeLabel,
      commodityId,
      commodityName: commodity.name,
      comparableTripCount: trips.length,
      minimumFreight: freight.length ? this.round2(Math.min(...freight)) : null,
      maximumFreight: freight.length ? this.round2(Math.max(...freight)) : null,
      averageFreight: freight.length
        ? this.round2(freight.reduce((sum, value) => sum + value, 0) / freight.length)
        : null,
      mostRecentFreight:
        trips.find(({ report }) => report.revenue !== null)?.report.revenue ?? null,
      averageProfit: profits.length
        ? this.round2(profits.reduce((sum, value) => sum + value, 0) / profits.length)
        : null,
      averageMarginPct: margins.length
        ? this.round2(margins.reduce((sum, value) => sum + value, 0) / margins.length)
        : null,
      recordedRateCount: snapshot.rates.filter(
        (rate) => rate.routeId === routeId && rate.commodityId === commodityId,
      ).length,
      confidence,
      explanation: `${baseExplanation}${customer ? ` Filtered to ${customer.name}.` : ''} Freight and profit use recorded trip values only.`,
      recentTrips: trips.slice(0, 20).map(({ report }) => report),
    };
  }

  private entityHistory(
    entityId: string,
    label: string,
    trips: EvaluatedTrip[],
    snapshot: Snapshot,
  ): BusinessMemoryEntityHistory {
    const reports = trips.map(({ report }) => report);
    const priced = reports.filter((report) => report.revenue !== null);
    const profitable = reports.filter((report) => report.profit !== null);
    const totalRevenue = priced.reduce((sum, report) => sum + (report.revenue ?? 0), 0);
    const totalExpenses = reports.reduce((sum, report) => sum + report.totalCost, 0);
    const distancesComplete =
      reports.length > 0 && reports.every((report) => report.distanceKm !== null);
    const totalDistance = distancesComplete
      ? reports.reduce((sum, report) => sum + (report.distanceKm ?? 0), 0)
      : 0;
    const customers = new Map(snapshot.customers.map((item) => [item.id, item.name]));
    const commodities = new Map(snapshot.commodities.map((item) => [item.id, item.name]));
    const vehicles = new Map(snapshot.vehicles.map((item) => [item.id, item.registrationNumber]));
    const totalProfit =
      profitable.length === reports.length && reports.length > 0
        ? this.round2(profitable.reduce((sum, report) => sum + (report.profit ?? 0), 0))
        : null;
    const completeRevenue = reports.length > 0 && priced.length === reports.length;
    const confidence = this.confidence(reports.length);
    const missingFreight = priced.length !== reports.length;
    return {
      entityId,
      label,
      tripCount: reports.length,
      pricedTripCount: priced.length,
      totalRevenue: priced.length ? this.round2(totalRevenue) : null,
      totalPaymentsReceived: this.round2(
        reports.reduce((sum, report) => sum + report.cashReceived, 0),
      ),
      outstanding: completeRevenue
        ? this.round2(reports.reduce((sum, report) => sum + (report.outstanding ?? 0), 0))
        : null,
      totalExpenses: this.round2(totalExpenses),
      totalProfit,
      averageFreightPerTrip: priced.length ? this.round2(totalRevenue / priced.length) : null,
      averageProfitPerTrip: profitable.length
        ? this.round2(
            profitable.reduce((sum, report) => sum + (report.profit ?? 0), 0) / profitable.length,
          )
        : null,
      averageMarginPct: reports.some((report) => report.marginPct !== null)
        ? this.round2(
            reports.reduce((sum, report) => sum + (report.marginPct ?? 0), 0) /
              reports.filter((report) => report.marginPct !== null).length,
          )
        : null,
      averageCostPerKm: totalDistance > 0 ? this.round2(totalExpenses / totalDistance) : null,
      fuelCost: this.round2(trips.reduce((sum, item) => sum + item.report.fuelCost, 0)),
      commodities: [
        ...new Set(
          trips
            .map((trip) =>
              trip.source.commodityId ? commodities.get(trip.source.commodityId) : null,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      routes: [...new Set(reports.map((report) => report.routeLabel))],
      customers: [
        ...new Set(
          trips
            .map((trip) => (trip.source.customerId ? customers.get(trip.source.customerId) : null))
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      vehicles: [
        ...new Set(
          trips
            .map((trip) => vehicles.get(trip.source.vehicleId))
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      tripDates: reports.map((report) => report.startDate),
      recentTrips: reports.slice(0, 10),
      confidence,
      explanation: `${this.sampleExplanation(reports.length, 'completed trips')}${missingFreight ? ' Profit total is withheld because freight is missing on one or more trips.' : ''}`,
    };
  }

  private async loadSnapshot(organizationId: string): Promise<Snapshot> {
    const [trips, vehicles, customers, commodities, routes, locations, rates] = await Promise.all([
      this.memory.findCompletedTrips(organizationId),
      this.memory.findVehicles(organizationId),
      this.memory.findCustomers(organizationId),
      this.memory.findCommodities(organizationId),
      this.memory.findRoutes(organizationId),
      this.memory.findLocations(organizationId),
      this.memory.findFreightRates(organizationId),
    ]);
    return { trips, vehicles, customers, commodities, routes, locations, rates };
  }

  private evaluateTrips(snapshot: Snapshot): EvaluatedTrip[] {
    const vehicles = new Map(snapshot.vehicles.map((item) => [item.id, item.registrationNumber]));
    const customers = new Map(snapshot.customers.map((item) => [item.id, item.name]));
    const commodities = new Map(snapshot.commodities.map((item) => [item.id, item.name]));
    const locations = new Map(
      snapshot.locations.map((item) => [
        item.id,
        item.name || item.city || item.state || 'Unknown',
      ]),
    );
    const routes = new Map(snapshot.routes.map((item) => [item.id, item]));
    return snapshot.trips.map((trip) => {
      const route = trip.routeId ? routes.get(trip.routeId) : undefined;
      const origin =
        trip.originName ||
        (route ? locations.get(route.originLocationId) : undefined) ||
        'Unknown origin';
      const destination =
        trip.destinationName ||
        (route ? locations.get(route.destinationLocationId) : undefined) ||
        'Unknown destination';
      const routeLabel = `${origin} → ${destination}`;
      const revenueValue = trip.actualFreight ?? trip.estimatedFreight;
      const result = ProfitabilityUtil.calculateEstimatedAndActual({
        estimatedFreight:
          trip.estimatedFreight === null ? null : ProfitabilityUtil.toNumber(trip.estimatedFreight),
        actualFreight:
          trip.actualFreight === null ? null : ProfitabilityUtil.toNumber(trip.actualFreight),
        expenses: trip.expenses,
        fuelTransactions: trip.fuelTransactions,
        estimatedDistanceKm:
          trip.estimatedDistanceKm === null
            ? null
            : ProfitabilityUtil.toNumber(trip.estimatedDistanceKm),
        actualDistanceKm:
          trip.actualDistanceKm === null ? null : ProfitabilityUtil.toNumber(trip.actualDistanceKm),
        loadWeightTons:
          trip.loadWeightTons === null ? null : ProfitabilityUtil.toNumber(trip.loadWeightTons),
      });
      const profitability = result.actual ?? result.estimated;
      const costBreakdown = ProfitabilityUtil.buildExpensesFromRecords(
        trip.expenses,
        trip.fuelTransactions,
      );
      const totalCost = ProfitabilityUtil.calculateTotalCost(costBreakdown);
      const revenue = revenueValue === null ? null : ProfitabilityUtil.toNumber(revenueValue);
      const collection = PaymentCollectionUtil.calculate(revenueValue, trip.payments);
      const distanceValue = trip.actualDistanceKm ?? trip.estimatedDistanceKm;
      const distanceKm = distanceValue === null ? null : ProfitabilityUtil.toNumber(distanceValue);
      const vehicleRegistrationNumber = vehicles.get(trip.vehicleId) ?? 'Vehicle';
      return {
        source: trip,
        routeKey: trip.routeId ?? `route:${this.normalize(routeLabel)}`,
        commodityKey: trip.commodityId,
        customerKey: trip.customerId,
        report: {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          startDate: trip.startDate.toISOString(),
          customerName: trip.customerId ? (customers.get(trip.customerId) ?? null) : null,
          origin,
          destination,
          routeLabel,
          commodityName: trip.commodityId ? (commodities.get(trip.commodityId) ?? null) : null,
          vehicleRegistrationNumber,
          revenue,
          totalCost: this.round2(totalCost),
          profit: profitability ? this.round2(profitability.profit) : null,
          marginPct: profitability?.marginPct == null ? null : this.round2(profitability.marginPct),
          distanceKm: distanceKm !== null && distanceKm > 0 ? distanceKm : null,
          costPerKm: profitability?.costPerKm == null ? null : this.round2(profitability.costPerKm),
          fuelCost: this.round2(costBreakdown.fuelCost),
          cashReceived: collection.received,
          outstanding: collection.outstanding,
          profitabilityBasis: profitability?.basis ?? null,
        },
      };
    });
  }

  private aggregate(
    trips: EvaluatedTrip[],
    keyOf: (trip: EvaluatedTrip) => string | null,
    labelOf: (trip: EvaluatedTrip) => string | null,
  ): BusinessMemoryHistoryEntry[] {
    const groups = new Map<string, EvaluatedTrip[]>();
    for (const trip of trips) {
      const key = keyOf(trip);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), trip]);
    }
    return [...groups.entries()]
      .map(([id, items]) => {
        const priced = items.filter(({ report }) => report.revenue !== null);
        const totalRevenue = priced.reduce((sum, item) => sum + (item.report.revenue ?? 0), 0);
        const totalCost = items.reduce((sum, item) => sum + item.report.totalCost, 0);
        const completeRevenue = priced.length === items.length && priced.length > 0;
        const totalProfit = completeRevenue ? this.round2(totalRevenue - totalCost) : null;
        const distancesComplete = items.every(({ report }) => report.distanceKm !== null);
        const distance = distancesComplete
          ? items.reduce((sum, item) => sum + (item.report.distanceKm ?? 0), 0)
          : 0;
        const confidence = this.confidence(items.length);
        const label = labelOf(items[0]) ?? 'Unspecified';
        return {
          id,
          label,
          tripCount: items.length,
          pricedTripCount: priced.length,
          totalRevenue: priced.length ? this.round2(totalRevenue) : null,
          totalCost: this.round2(totalCost),
          totalProfit,
          marginPct:
            totalProfit !== null && totalRevenue > 0
              ? this.round2((totalProfit / totalRevenue) * 100)
              : null,
          averageRevenuePerTrip: priced.length ? this.round2(totalRevenue / priced.length) : null,
          averageCostPerKm: distance > 0 ? this.round2(totalCost / distance) : null,
          lastTripDate:
            items
              .map(({ report }) => report.startDate)
              .sort()
              .at(-1) ?? null,
          confidence,
          explanation:
            this.sampleExplanation(items.length, 'matching completed trips') +
            (priced.length < items.length
              ? ' Profit is withheld because freight is missing on some trips.'
              : ''),
        } satisfies BusinessMemoryHistoryEntry;
      })
      .sort(
        (left, right) => right.tripCount - left.tripCount || left.label.localeCompare(right.label),
      );
  }

  private aggregateRates(snapshot: Snapshot): BusinessMemoryFreightRate[] {
    const locations = new Map(
      snapshot.locations.map((item) => [
        item.id,
        item.name || item.city || item.state || 'Unknown',
      ]),
    );
    const routes = new Map(snapshot.routes.map((item) => [item.id, item]));
    const commodities = new Map(snapshot.commodities.map((item) => [item.id, item.name]));
    const groups = new Map<string, FreightRate[]>();
    for (const rate of snapshot.rates) {
      const key = [
        rate.routeId,
        rate.commodityId ?? '',
        rate.vehicleType ?? '',
        rate.rateBasis,
      ].join('|');
      groups.set(key, [...(groups.get(key) ?? []), rate]);
    }
    return [...groups.entries()]
      .map(([id, rates]) => {
        const ordered = [...rates].sort(
          (left, right) => right.effectiveDate.getTime() - left.effectiveDate.getTime(),
        );
        const amounts = rates.map((rate) => ProfitabilityUtil.toNumber(rate.freightAmount));
        const route = routes.get(ordered[0].routeId);
        const routeLabel = route
          ? `${locations.get(route.originLocationId) ?? 'Unknown'} → ${locations.get(route.destinationLocationId) ?? 'Unknown'}`
          : 'Unknown route';
        const confidence = this.confidence(rates.length);
        return {
          id,
          routeLabel,
          commodityName: ordered[0].commodityId
            ? (commodities.get(ordered[0].commodityId) ?? null)
            : null,
          vehicleType: ordered[0].vehicleType,
          rateBasis: ordered[0].rateBasis,
          sampleSize: rates.length,
          minimumRate: this.round2(Math.min(...amounts)),
          averageRate: this.round2(
            amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
          ),
          maximumRate: this.round2(Math.max(...amounts)),
          latestRate: this.round2(ProfitabilityUtil.toNumber(ordered[0].freightAmount)),
          latestEffectiveDate: ordered[0].effectiveDate.toISOString(),
          confidence,
          explanation:
            this.sampleExplanation(rates.length, 'recorded freight rates') +
            ' Rates are grouped by route, commodity, vehicle type, and rate basis.',
        } satisfies BusinessMemoryFreightRate;
      })
      .sort((left, right) => right.latestEffectiveDate.localeCompare(left.latestEffectiveDate));
  }

  private confidence(sampleSize: number): BusinessMemoryConfidence {
    if (sampleSize < BUSINESS_MEMORY_SAMPLE_THRESHOLDS.limited) return 'INSUFFICIENT';
    if (sampleSize < BUSINESS_MEMORY_SAMPLE_THRESHOLDS.supported) return 'LIMITED';
    return 'SUPPORTED';
  }

  private sampleExplanation(sampleSize: number, subject: string): string {
    if (sampleSize < BUSINESS_MEMORY_SAMPLE_THRESHOLDS.limited)
      return sampleSize === 0
        ? `Insufficient historical data. No ${subject} are available yet.`
        : `Insufficient historical data. Based on ${sampleSize} ${subject}, which is too small for a reliable comparison.`;
    if (sampleSize < BUSINESS_MEMORY_SAMPLE_THRESHOLDS.supported)
      return `Based on ${sampleSize} ${subject}; treat this as a limited historical sample.`;
    return `Based on ${sampleSize} ${subject}; this is historical evidence, not a forecast.`;
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }

  private routeLabel(
    snapshot: Snapshot,
    route: NonNullable<Awaited<ReturnType<BusinessMemoryRepository['findRouteForOrganization']>>>,
  ) {
    const locations = new Map(
      snapshot.locations.map((item) => [
        item.id,
        item.name || item.city || item.state || 'Unknown',
      ]),
    );
    return `${locations.get(route.originLocationId) ?? 'Unknown'} → ${locations.get(route.destinationLocationId) ?? 'Unknown'}`;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
