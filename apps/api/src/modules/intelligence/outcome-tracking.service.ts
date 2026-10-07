import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ProfitabilityUtil } from './profitability/profitability.util';
import { PaymentCollectionUtil } from '@/modules/payments/payment-collection.util';
import type { LoadPredictionStatus, Prisma } from '@prisma/client';

const MIN_CALIBRATION_SAMPLE = 5;
const WITH_TRIP = {
  trip: {
    include: {
      expenses: true,
      fuelTransactions: true,
      payments: true,
      route: true,
      vehicle: true,
      commodity: true,
      customer: true,
    },
  },
} as const;
type Dimension = 'route' | 'vehicle' | 'commodity' | 'customer' | 'routeCommodity';
type OutcomeRecord = Prisma.LoadPredictionGetPayload<{ include: typeof WITH_TRIP }>;
type PredictionSnapshot = {
  expectedRevenue?: { amount?: unknown };
  expectedCost?: { total?: unknown };
  expectedProfit?: unknown;
  expectedMarginPct?: unknown;
  costPerKm?: unknown;
  profitPerKm?: unknown;
};
type ComparisonMetrics = {
  revenue: ReturnType<typeof compare>;
  cost: ReturnType<typeof compare>;
  profit: ReturnType<typeof compare>;
  margin: { predicted: number | null; actual: number | null; differencePoints: number | null };
  costPerKm: ReturnType<typeof compare>;
  profitPerKm: ReturnType<typeof compare>;
};
type OutcomeView = {
  id: string;
  predictionId: string;
  decision: string;
  outcomeStatus: LoadPredictionStatus;
  analyzedAt: Date;
  predictionVersion: string;
  input: Prisma.JsonValue;
  prediction: {
    revenue: number | null;
    cost: number | null;
    profit: number | null;
    marginPct: number | null;
    costPerKm: number | null;
    profitPerKm: number | null;
  };
  actual: {
    revenue: number;
    cashReceived: number;
    cost: number;
    profit: number;
    marginPct: number | null;
    costPerKm: number | null;
    profitPerKm: number | null;
  } | null;
  comparison: ComparisonMetrics | null;
  trip: {
    id: string;
    tripNumber: string;
    status: string;
    financialStatus: string;
    originName: string;
    destinationName: string;
    vehicle: { registrationNumber: string };
    commodity: { name: string } | null;
    customer: { name: string } | null;
  } | null;
  message?: string;
};

@Injectable()
export class OutcomeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.loadPrediction.findMany({
      where: { organizationId },
      include: WITH_TRIP,
      orderBy: { analyzedAt: 'desc' },
    });
    return rows.map((row) => this.present(row));
  }

  async get(organizationId: string, predictionId: string) {
    return this.present(await this.find(organizationId, predictionId));
  }

  async comparison(organizationId: string, predictionId: string) {
    return this.present(await this.find(organizationId, predictionId));
  }

  async linkTrip(organizationId: string, predictionId: string, tripId: string) {
    const prediction = await this.prisma.loadPrediction.findFirst({
      where: { id: predictionId, organizationId },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.tripId)
      throw new ConflictException('This prediction is already linked to a trip');
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, organizationId },
      select: { id: true, routeId: true, customerId: true, commodityId: true, vehicleId: true },
    });
    if (!trip) throw new NotFoundException('Trip not found in your organization');
    const input = prediction.inputSnapshot as Record<string, unknown>;
    const checks: Array<[string, string | null]> = [
      ['routeId', trip.routeId],
      ['customerId', trip.customerId],
      ['commodityId', trip.commodityId],
      ['vehicleId', trip.vehicleId],
    ];
    for (const [field, actual] of checks) {
      const expected = input[field];
      if (expected && expected !== actual)
        throw new BadRequestException(`Trip ${field} does not match the analyzed load`);
    }
    await this.prisma.loadPrediction.update({ where: { id: prediction.id }, data: { tripId } });
    return this.get(organizationId, predictionId);
  }

  async markNotExecuted(organizationId: string, predictionId: string) {
    const prediction = await this.prisma.loadPrediction.findFirst({
      where: { id: predictionId, organizationId },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.tripId)
      throw new ConflictException('A linked prediction cannot be marked as not executed');
    await this.prisma.loadPrediction.update({
      where: { id: prediction.id },
      data: { outcomeStatus: 'NOT_EXECUTED' },
    });
    return this.get(organizationId, predictionId);
  }

  async summary(organizationId: string) {
    const rows = (
      await this.prisma.loadPrediction.findMany({
        where: { organizationId },
        include: WITH_TRIP,
        orderBy: { analyzedAt: 'desc' },
      })
    ).map((r) => this.present(r));
    const completed = rows.filter((r) => r.outcomeStatus === 'COMPLETED');
    if (completed.length < MIN_CALIBRATION_SAMPLE)
      return {
        sufficientData: false,
        minimumSampleSize: MIN_CALIBRATION_SAMPLE,
        message: 'Insufficient outcome data.',
        analyzedLoads: rows.length,
        completed: completed.length,
        pending: rows.filter(
          (r) => r.outcomeStatus === 'PENDING' || r.outcomeStatus === 'INSUFFICIENT_ACTUAL_DATA',
        ).length,
      };
    const errors = completed
      .map((r) => r.comparison?.profit.error ?? null)
      .filter((v): v is number => v !== null);
    const marginErrors = completed
      .map((r) => r.comparison?.margin.differencePoints ?? null)
      .filter((v): v is number => v !== null);
    const within = completed.filter(
      (r) =>
        r.comparison?.profit.errorPct !== null &&
        r.comparison?.profit.errorPct !== undefined &&
        Math.abs(r.comparison.profit.errorPct) <= 15,
    ).length;
    const recommendationPerformance = ['ACCEPT', 'REVIEW', 'AVOID'].map((decision) => {
      const subset = completed.filter((r) => r.decision === decision);
      return {
        decision,
        completed: subset.length,
        profitable: subset.filter((r) => (r.actual?.profit ?? 0) > 0).length,
      };
    });
    return {
      sufficientData: true,
      minimumSampleSize: MIN_CALIBRATION_SAMPLE,
      analyzedLoads: rows.length,
      completed: completed.length,
      pending: rows.filter(
        (r) => r.outcomeStatus === 'PENDING' || r.outcomeStatus === 'INSUFFICIENT_ACTUAL_DATA',
      ).length,
      averagePredictedProfit: average(
        completed.map((r) => r.prediction.profit).filter((v): v is number => v !== null),
      ),
      averageActualProfit: average(
        completed.map((r) => r.actual!.profit).filter((v): v is number => v !== null),
      ),
      meanAbsoluteProfitError: average(errors.map(Math.abs)),
      meanAbsoluteMarginErrorPoints: average(marginErrors.map(Math.abs)),
      averageOverestimation: average(errors.filter((v) => v < 0).map(Math.abs)),
      averageUnderestimation: average(errors.filter((v) => v > 0)),
      within15Percent: round((within / completed.length) * 100),
      recommendationPerformance,
    };
  }

  async aggregate(organizationId: string, dimension: Dimension) {
    const rows = (
      await this.prisma.loadPrediction.findMany({
        where: { organizationId, trip: { status: 'COMPLETED' } },
        include: WITH_TRIP,
      })
    )
      .map((r) => this.present(r))
      .filter((r) => r.outcomeStatus === 'COMPLETED');
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const trip = row.trip;
      if (!trip) continue;
      const label =
        dimension === 'route'
          ? `${trip.originName} → ${trip.destinationName}`
          : dimension === 'vehicle'
            ? trip.vehicle.registrationNumber
            : dimension === 'customer'
              ? (trip.customer?.name ?? 'Unknown customer')
              : dimension === 'routeCommodity'
                ? `${trip.originName} → ${trip.destinationName} · ${trip.commodity?.name ?? 'Unknown commodity'}`
                : (trip.commodity?.name ?? 'Unknown commodity');
      grouped.set(label, [...(grouped.get(label) ?? []), row]);
    }
    return [...grouped.entries()].map(([label, group]) => ({
      label,
      sampleSize: group.length,
      sufficientData: group.length >= MIN_CALIBRATION_SAMPLE,
      averagePredictedProfit:
        group.length >= MIN_CALIBRATION_SAMPLE
          ? average(group.map((r) => r.prediction.profit).filter((v): v is number => v !== null))
          : null,
      averageActualProfit:
        group.length >= MIN_CALIBRATION_SAMPLE
          ? average(group.map((r) => r.actual!.profit).filter((v): v is number => v !== null))
          : null,
      averageProfitError:
        group.length >= MIN_CALIBRATION_SAMPLE
          ? average(
              group
                .map((r) => r.comparison?.profit.error ?? null)
                .filter((v): v is number => v !== null),
            )
          : null,
    }));
  }

  private async find(organizationId: string, id: string) {
    const row = await this.prisma.loadPrediction.findFirst({
      where: { id, organizationId },
      include: WITH_TRIP,
    });
    if (!row) throw new NotFoundException('Prediction not found');
    return row;
  }

  private present(row: OutcomeRecord): OutcomeView {
    const saved = row.predictionSnapshot as unknown as PredictionSnapshot;
    const prediction = {
      revenue: numberOrNull(saved.expectedRevenue?.amount),
      cost: numberOrNull(saved.expectedCost?.total),
      profit: numberOrNull(saved.expectedProfit),
      marginPct: numberOrNull(saved.expectedMarginPct),
      costPerKm: numberOrNull(saved.costPerKm),
      profitPerKm: numberOrNull(saved.profitPerKm),
    };
    let outcomeStatus: LoadPredictionStatus = row.tripId
      ? 'INSUFFICIENT_ACTUAL_DATA'
      : row.outcomeStatus;
    let actual: OutcomeView['actual'] = null;
    let comparison: ComparisonMetrics | null = null;
    if (row.trip?.status === 'CANCELLED') outcomeStatus = 'CANCELLED';
    if (
      row.trip?.status === 'COMPLETED' &&
      row.trip.financialStatus === 'FINALIZED' &&
      row.trip.actualFreight !== null
    ) {
      const trip = row.trip;
      const revenue = ProfitabilityUtil.toNumber(trip.actualFreight);
      const costsBreakdown = ProfitabilityUtil.buildExpensesFromRecords(
        trip.expenses,
        trip.fuelTransactions,
      );
      const distance =
        trip.actualDistanceKm == null
          ? trip.estimatedDistanceKm == null
            ? null
            : ProfitabilityUtil.toNumber(trip.estimatedDistanceKm)
          : ProfitabilityUtil.toNumber(trip.actualDistanceKm);
      const metrics = ProfitabilityUtil.calculateTripProfitability(
        revenue,
        costsBreakdown,
        distance ?? undefined,
      );
      const collection = PaymentCollectionUtil.calculate(trip.actualFreight, trip.payments);
      actual = {
        revenue: round(revenue),
        cashReceived: collection.received,
        cost: round(metrics.totalCost),
        profit: round(metrics.profit),
        marginPct: metrics.marginPct === null ? null : round(metrics.marginPct),
        costPerKm: metrics.costPerKm === null ? null : round(metrics.costPerKm),
        profitPerKm: metrics.profitPerKm === null ? null : round(metrics.profitPerKm),
      };
      comparison = {
        revenue: compare(prediction.revenue, actual.revenue),
        cost: compare(prediction.cost, actual.cost),
        profit: compare(prediction.profit, actual.profit),
        margin: {
          predicted: prediction.marginPct,
          actual: actual.marginPct,
          differencePoints: delta(prediction.marginPct, actual.marginPct),
        },
        costPerKm: compare(prediction.costPerKm, actual.costPerKm),
        profitPerKm: compare(prediction.profitPerKm, actual.profitPerKm),
      };
      outcomeStatus = 'COMPLETED';
    }
    return {
      id: row.id,
      predictionId: row.id,
      decision: row.decision,
      outcomeStatus,
      analyzedAt: row.analyzedAt,
      predictionVersion: row.methodVersion,
      input: row.inputSnapshot,
      prediction,
      actual,
      comparison,
      trip: row.trip
        ? {
            id: row.trip.id,
            tripNumber: row.trip.tripNumber,
            status: row.trip.status,
            financialStatus: row.trip.financialStatus,
            originName: row.trip.originName,
            destinationName: row.trip.destinationName,
            vehicle: { registrationNumber: row.trip.vehicle.registrationNumber },
            commodity: row.trip.commodity ? { name: row.trip.commodity.name } : null,
            customer: row.trip.customer ? { name: row.trip.customer.name } : null,
          }
        : null,
      message:
        outcomeStatus === 'INSUFFICIENT_ACTUAL_DATA'
          ? row.trip?.status !== 'COMPLETED'
            ? 'Waiting for trip completion and financial finalization.'
            : row.trip.financialStatus !== 'FINALIZED'
              ? 'Waiting for financial finalization.'
              : 'Actual profitability is not yet available.'
          : undefined,
    };
  }
}

function compare(predicted: number | null, actual: number | null) {
  const error = delta(predicted, actual);
  return {
    predicted,
    actual,
    error,
    errorPct:
      predicted === null || predicted === 0 || error === null
        ? null
        : round((error / Math.abs(predicted)) * 100),
  };
}
function delta(predicted: number | null, actual: number | null) {
  return predicted === null || actual === null ? null : round(actual - predicted);
}
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function average(values: number[]) {
  return values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
