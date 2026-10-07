import { Injectable, BadRequestException } from '@nestjs/common';
import { LOAD_PROFITABILITY_THRESHOLDS as THRESHOLDS } from '@fleetnexus/shared';
import { BusinessMemoryService } from './business-memory.service';
import type { LoadProfitabilityDto } from './dto/load-profitability.dto';

type Component = 'fuel' | 'toll' | 'driver' | 'loadingUnloading' | 'maintenance' | 'other';
const COMPONENTS: Component[] = [
  'fuel',
  'toll',
  'driver',
  'loadingUnloading',
  'maintenance',
  'other',
];

@Injectable()
export class LoadProfitabilityService {
  constructor(private readonly businessMemory: BusinessMemoryService) {}

  async analyze(organizationId: string, input: LoadProfitabilityDto) {
    const pickup = new Date(input.proposedPickupDate);
    const delivery = input.proposedDeliveryDate ? new Date(input.proposedDeliveryDate) : undefined;
    if (delivery && delivery < pickup)
      throw new BadRequestException('Proposed delivery date cannot be before pickup date');
    const data = await this.businessMemory.getLoadComparables(organizationId, {
      routeId: input.routeId,
      commodityId: input.commodityId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
      ...(input.expectedDistanceKm ? { distanceKm: input.expectedDistanceKm } : {}),
      ...(input.loadWeightTons ? { loadWeightTons: input.loadWeightTons } : {}),
      proposedDate: pickup,
    });
    const trips = data.trips;
    const priced = trips.filter((trip) => trip.revenue !== null);
    const actualFreightTripCount = trips.filter((trip) => trip.revenueBasis === 'ACTUAL').length;
    const estimatedFreightTripCount = trips.filter(
      (trip) => trip.revenueBasis === 'ESTIMATED',
    ).length;
    const costBearing = trips.filter((trip) =>
      COMPONENTS.some((component) => trip.componentEvidence[component]),
    );
    const average = (values: number[]) =>
      values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const mean = (component: Component) => {
      const rows = trips.filter((trip) => trip.componentEvidence[component]);
      if (rows.length < THRESHOLDS.minimumComponentSamples)
        return {
          amount: null,
          sampleSize: rows.length,
          basis: 'Unavailable: fewer than the required recorded comparable-trip samples.',
        };
      const amounts = rows.map((trip) => trip.componentValues[component]);
      return {
        amount: average(amounts),
        sampleSize: rows.length,
        basis: `Average recorded ${componentLabel(component)} per comparable trip.`,
      };
    };
    const components = Object.fromEntries(
      COMPONENTS.map((component) => [component, mean(component)]),
    ) as Record<Component, ReturnType<typeof mean>>;

    const historicalFuelAverage = components.fuel.amount;
    let fuelMethod = 'HISTORICAL_ROUTE_COMMODITY_AVERAGE';
    let fuel = components.fuel;
    if (input.expectedDistanceKm && input.vehicleId) {
      const vehicleTrips = trips.filter(
        (trip) => trip.vehicleId === input.vehicleId && trip.distanceKm && trip.fuelLitres > 0,
      );
      if (vehicleTrips.length >= THRESHOLDS.minimumComponentSamples) {
        const efficiencies = vehicleTrips
          .map((trip) => trip.distanceKm! / trip.fuelLitres)
          .filter((value) => value > 0);
        const prices = vehicleTrips
          .filter((trip) => trip.fuelLitres > 0 && trip.fuelPurchaseAmount > 0)
          .map((trip) => trip.fuelPurchaseAmount / trip.fuelLitres);
        if (
          efficiencies.length >= THRESHOLDS.minimumComponentSamples &&
          prices.length >= THRESHOLDS.minimumComponentSamples
        ) {
          const kmPerLitre = median(efficiencies);
          const pricePerLitre = average(prices)!;
          fuel = {
            amount: round((input.expectedDistanceKm / kmPerLitre) * pricePerLitre),
            sampleSize: Math.min(efficiencies.length, prices.length),
            basis: `Selected-vehicle observed fuel efficiency (${round(kmPerLitre)} km/L) and historical purchase price (${pricePerLitre.toFixed(2)} per litre).`,
          };
          fuelMethod = 'OBSERVED_VEHICLE_EFFICIENCY_AND_FUEL_PRICE';
        }
      }
    }
    components.fuel = fuel;

    const expectedRevenue =
      input.offeredFreight !== undefined
        ? { amount: input.offeredFreight, basis: 'PROVIDED', sampleSize: null }
        : priced.length >= THRESHOLDS.minimumComponentSamples
          ? {
              amount: average(priced.map((trip) => trip.revenue!)),
              basis: 'HISTORICAL_ESTIMATE',
              sampleSize: priced.length,
            }
          : { amount: null, basis: 'UNAVAILABLE', sampleSize: priced.length };
    const averageRecordedTotalCost =
      costBearing.length >= THRESHOLDS.minimumComponentSamples
        ? average(costBearing.map((trip) => trip.totalCost))
        : null;
    const expectedTotalCost =
      averageRecordedTotalCost !== null &&
      fuelMethod === 'OBSERVED_VEHICLE_EFFICIENCY_AND_FUEL_PRICE' &&
      fuel.amount !== null &&
      historicalFuelAverage !== null
        ? round(averageRecordedTotalCost + fuel.amount - historicalFuelAverage)
        : averageRecordedTotalCost;
    const expectedDistance = input.expectedDistanceKm ?? data.route.estimatedDistanceKm;
    const distanceBasis = input.expectedDistanceKm
      ? 'PROVIDED'
      : data.route.estimatedDistanceKm
        ? 'SAVED_ROUTE_ESTIMATE'
        : null;
    const expectedProfit =
      expectedRevenue.amount !== null && expectedTotalCost !== null
        ? round(expectedRevenue.amount - expectedTotalCost)
        : null;
    const expectedMarginPct =
      expectedProfit !== null && expectedRevenue.amount! > 0
        ? round((expectedProfit / expectedRevenue.amount!) * 100)
        : null;
    const status =
      trips.length >= THRESHOLDS.supportedFrom &&
      expectedRevenue.amount !== null &&
      expectedTotalCost !== null
        ? 'SUPPORTED'
        : trips.length >= THRESHOLDS.insufficientBelow &&
            expectedRevenue.amount !== null &&
            expectedTotalCost !== null
          ? 'LIMITED'
          : 'INSUFFICIENT_DATA';
    const historicalProfit = trips
      .map((trip) => trip.profit)
      .filter((value): value is number => value !== null);
    const historicalMargins = trips
      .map((trip) => trip.marginPct)
      .filter((value): value is number => value !== null);
    const historicalCosts = trips
      .map((trip) => trip.totalCost)
      .filter((value): value is number => value !== null);
    const historicalCostPerKm = trips
      .filter((trip) => trip.distanceKm !== null && trip.distanceKm > 0)
      .map((trip) => trip.totalCost / trip.distanceKm!);
    const averageHistoricalProfit = average(historicalProfit);
    const performanceSummary = (rows: typeof trips) => {
      const profits = rows
        .map((trip) => trip.profit)
        .filter((value): value is number => value !== null);
      const margins = rows
        .map((trip) => trip.marginPct)
        .filter((value): value is number => value !== null);
      const costPerKmValues = rows
        .filter((trip) => trip.distanceKm !== null && trip.distanceKm > 0)
        .map((trip) => trip.totalCost / trip.distanceKm!);
      const sampleSize = profits.length;
      const performanceStatus =
        sampleSize >= THRESHOLDS.supportedFrom
          ? 'SUPPORTED'
          : sampleSize >= THRESHOLDS.insufficientBelow
            ? 'LIMITED'
            : 'INSUFFICIENT_DATA';
      return {
        sampleSize,
        status: performanceStatus,
        averageProfit: average(profits),
        averageMarginPct: average(margins),
        negativeProfitCount: profits.filter((value) => value < 0).length,
        negativeProfitShare: profits.length
          ? round((profits.filter((value) => value < 0).length / profits.length) * 100)
          : null,
        averageCostPerKm: average(costPerKmValues),
      };
    };
    const proposedQuarter = Math.floor(pickup.getUTCMonth() / 3);
    const selectedVehicleTrips = input.vehicleId
      ? trips.filter((trip) => trip.vehicleId === input.vehicleId)
      : [];
    const customerTrips = input.customerId
      ? trips.filter((trip) => trip.customerId === input.customerId)
      : [];
    const seasonalTrips = trips.filter(
      (trip) => Math.floor(new Date(trip.date).getUTCMonth() / 3) === proposedQuarter,
    );
    const benchmarkDifference =
      expectedProfit !== null && averageHistoricalProfit !== null
        ? round(expectedProfit - averageHistoricalProfit)
        : null;
    const risks: Array<{
      code: string;
      severity: 'INFO' | 'WARNING' | 'HIGH';
      explanation: string;
    }> = [];
    if (trips.length === 0)
      risks.push({
        code: 'NO_COMPARABLE_TRIPS',
        severity: 'HIGH',
        explanation:
          'No completed trips share this route and commodity; costs and profit cannot be supported by a comparable sample.',
      });
    else if (trips.length < THRESHOLDS.supportedFrom)
      risks.push({
        code: 'LOW_SAMPLE_SIZE',
        severity: 'WARNING',
        explanation: `Only ${trips.length} comparable trips; ${THRESHOLDS.supportedFrom} are required for SUPPORTED status.`,
      });
    if (expectedRevenue.basis === 'HISTORICAL_ESTIMATE')
      risks.push({
        code: 'ESTIMATED_FREIGHT',
        severity: 'WARNING',
        explanation:
          'Freight was estimated from comparable completed-trip records because no offered freight was supplied.',
      });
    if (fuel.amount === null)
      risks.push({
        code: 'MISSING_FUEL_DATA',
        severity: 'WARNING',
        explanation:
          'Fuel cost is unavailable because too few comparable trips contain recorded fuel costs or selected-vehicle efficiency data.',
      });
    if (expectedDistance === null)
      risks.push({
        code: 'MISSING_DISTANCE',
        severity: 'WARNING',
        explanation:
          'No proposed distance or saved route estimate is available; per-kilometre metrics are omitted.',
      });
    if (components.toll.amount === null)
      risks.push({
        code: 'MISSING_TOLL_DATA',
        severity: 'WARNING',
        explanation: 'No reliable historical route toll sample is available.',
      });
    const missingComponents = COMPONENTS.filter(
      (component) => components[component].amount === null,
    );
    if (missingComponents.length)
      risks.push({
        code: 'MISSING_COMPONENT_COSTS',
        severity: 'WARNING',
        explanation: `Component averages are unavailable for: ${missingComponents.map(componentLabel).join(', ')}. The total uses recorded comparable-trip costs; these missing category averages are not treated as verified zero cost.`,
      });
    if (costBearing.length < THRESHOLDS.minimumComponentSamples)
      risks.push({
        code: 'MISSING_EXPENSE_HISTORY',
        severity: 'WARNING',
        explanation: 'Too few comparable trips have recorded cost data to estimate total cost.',
      });
    if (
      input.vehicleId &&
      trips.filter((trip) => trip.vehicleId === input.vehicleId).length <
        THRESHOLDS.minimumComponentSamples
    )
      risks.push({
        code: 'LIMITED_VEHICLE_HISTORY',
        severity: 'INFO',
        explanation:
          'Selected vehicle has limited matching route and commodity history; route/commodity cost averages are used where available.',
      });

    const historicalProfitMedian = median(historicalProfit);
    const recentTrips = trips.slice(0, THRESHOLDS.recentTripLimit).map((trip) => ({
      tripId: trip.tripId,
      tripNumber: trip.tripNumber,
      date: trip.date,
      revenue: trip.revenue,
      revenueBasis: trip.revenueBasis,
      totalCost: trip.totalCost,
      profit: trip.profit,
      marginPct: trip.marginPct,
      costBreakdown: trip.costBreakdown,
      similarityReasons: trip.similarityReasons,
    }));
    return {
      analysisStatus: status,
      input: {
        customer: data.customer,
        route: data.route,
        commodity: data.commodity,
        vehicle: data.vehicle,
        proposedPickupDate: pickup.toISOString(),
        proposedDeliveryDate: delivery?.toISOString() ?? null,
        offeredFreight: input.offeredFreight ?? null,
        loadWeightTons: input.loadWeightTons ?? null,
        distanceKm: expectedDistance,
        distanceBasis,
      },
      historical: {
        comparableTripCount: trips.length,
        pricedTripCount: priced.length,
        actualFreightTripCount,
        estimatedFreightTripCount,
        costEvidenceTripCount: costBearing.length,
        averageFreight: average(priced.map((trip) => trip.revenue!)),
        averageTotalCost: average(historicalCosts),
        averageProfit: averageHistoricalProfit,
        medianProfit: historicalProfit.length ? historicalProfitMedian : null,
        averageMarginPct: average(historicalMargins),
        negativeProfitTripCount: historicalProfit.filter((value) => value < 0).length,
        negativeProfitSharePct: historicalProfit.length
          ? round(
              (historicalProfit.filter((value) => value < 0).length / historicalProfit.length) *
                100,
            )
          : null,
        averageCostPerKm: average(historicalCostPerKm),
        explanation: data.explanation,
        recentTrips,
      },
      estimate: {
        revenue: expectedRevenue,
        costs: {
          components: { ...components, fuel: { ...components.fuel, method: fuelMethod } },
          total: expectedTotalCost,
          sampleSize: costBearing.length,
          basis:
            fuelMethod === 'OBSERVED_VEHICLE_EFFICIENCY_AND_FUEL_PRICE'
              ? 'Average total recorded cost for comparable trips, adjusted by replacing its historical fuel average with the selected vehicle’s observed distance/efficiency and fuel-price estimate.'
              : 'Average total recorded cost among comparable completed trips with expense or fuel records; unrecorded costs are not assumed to be zero.',
        },
        profit: expectedProfit,
        marginPct: expectedMarginPct,
        costPerKm:
          expectedTotalCost !== null && expectedDistance && expectedDistance > 0
            ? round(expectedTotalCost / expectedDistance)
            : null,
        profitPerKm:
          expectedProfit !== null && expectedDistance && expectedDistance > 0
            ? round(expectedProfit / expectedDistance)
            : null,
      },
      benchmark: {
        averageHistoricalProfit,
        medianHistoricalProfit: historicalProfit.length ? historicalProfitMedian : null,
        averageHistoricalMarginPct: average(historicalMargins),
        averageHistoricalCost: average(historicalCosts),
        proposedProfit: expectedProfit,
        proposedMarginPct: expectedMarginPct,
        profitDifferenceFromAverage: benchmarkDifference,
        explanation:
          benchmarkDifference === null
            ? 'A profit comparison is unavailable without both a proposed estimate and priced comparable history.'
            : `Projected profit is approximately ${Math.abs(benchmarkDifference).toFixed(2)} ${benchmarkDifference >= 0 ? 'above' : 'below'} the average of ${historicalProfit.length} comparable historical trips. This is an estimate, not a certainty.`,
      },
      performance: {
        routeCommodity: performanceSummary(trips),
        selectedVehicle: input.vehicleId ? performanceSummary(selectedVehicleTrips) : null,
        customer: input.customerId ? performanceSummary(customerTrips) : null,
        sameQuarter: performanceSummary(seasonalTrips),
        explanation:
          'Performance summaries use completed trips matching the route and commodity; vehicle and customer summaries use the matching subset. Same-quarter values are historical context only, not a seasonal forecast.',
      },
      sample: {
        count: trips.length,
        status,
        thresholds: THRESHOLDS,
        explanation:
          status === 'SUPPORTED'
            ? `Based on ${trips.length} comparable completed trips.`
            : status === 'LIMITED'
              ? `Based on a limited sample of ${trips.length} comparable trips.`
              : `Unable to provide a reliable profitability estimate: comparable trip or cost/revenue evidence is insufficient.`,
      },
      dataQuality: risks,
      explanation:
        status === 'INSUFFICIENT_DATA'
          ? 'Unable to provide a reliable profitability estimate. Review the data-quality issues and add completed trips with freight, distance, expenses, and fuel records.'
          : `Historical comparable-trip economics indicate an estimated profit of ${expectedProfit} and margin of ${expectedMarginPct}%. Estimates use ${expectedRevenue.basis.toLowerCase()} revenue and recorded costs; see each component basis and data-quality flag.`,
    };
  }
}

function round(value: number | null) {
  return value === null ? null : Math.round(value * 100) / 100;
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function componentLabel(component: Component) {
  return {
    fuel: 'fuel',
    toll: 'toll',
    driver: 'driver',
    loadingUnloading: 'loading/unloading',
    maintenance: 'maintenance',
    other: 'other',
  }[component];
}
