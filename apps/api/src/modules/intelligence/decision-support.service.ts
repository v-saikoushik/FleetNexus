import { Injectable } from '@nestjs/common';
import { DECISION_SUPPORT_THRESHOLDS as THRESHOLDS } from '@fleetnexus/shared';
import { LoadProfitabilityService } from './load-profitability.service';
import type { LoadProfitabilityDto } from './dto/load-profitability.dto';
import { PrismaService } from '@/database/prisma.service';

type RuleResult = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_AVAILABLE';
type Rule = {
  code: string;
  result: RuleResult;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metric: string | number | null;
  explanation: string;
};

@Injectable()
export class DecisionSupportService {
  constructor(
    private readonly loadProfitability: LoadProfitabilityService,
    private readonly prisma: PrismaService,
  ) {}

  async analyze(organizationId: string, input: LoadProfitabilityDto) {
    // Load Economics owns validation, matching, cost calculation and historical benchmarks.
    const economics = await this.loadProfitability.analyze(organizationId, input);
    const estimate = economics.estimate;
    const historical = economics.historical;
    const performance = economics.performance;
    const warnings = economics.dataQuality.map((item) => ({
      ...item,
      severity:
        (THRESHOLDS.criticalDataQualityCodes as readonly string[]).includes(item.code) ||
        item.severity === 'HIGH'
          ? ('CRITICAL' as const)
          : item.severity,
    }));
    const rules: Rule[] = [];
    const add = (
      code: string,
      result: RuleResult,
      metric: string | number | null,
      explanation: string,
    ) => {
      rules.push({
        code,
        result,
        severity: result === 'FAIL' ? 'CRITICAL' : result === 'WARNING' ? 'WARNING' : 'INFO',
        metric,
        explanation,
      });
    };

    if (estimate.profit === null)
      add(
        'PROFITABILITY_POSITIVE',
        'NOT_AVAILABLE',
        null,
        'Expected profit is unavailable because expected revenue or recorded comparable-trip cost evidence is insufficient.',
      );
    else if (estimate.profit > 0)
      add(
        'PROFITABILITY_POSITIVE',
        'PASS',
        estimate.profit,
        `Expected profit is ${money(estimate.profit)}.`,
      );
    else if (estimate.profit < 0)
      add(
        'PROFITABILITY_POSITIVE',
        'FAIL',
        estimate.profit,
        `Expected cost exceeds expected revenue; estimated loss is ${money(Math.abs(estimate.profit))}.`,
      );
    else
      add(
        'PROFITABILITY_POSITIVE',
        'WARNING',
        estimate.profit,
        'Expected profit is zero, leaving no economic buffer.',
      );

    if (estimate.marginPct === null)
      add(
        'MARGIN_ACCEPTABLE',
        'NOT_AVAILABLE',
        null,
        'Expected margin is unavailable without a valid expected revenue and cost estimate.',
      );
    else if (estimate.marginPct < THRESHOLDS.unacceptableMarginPct)
      add(
        'MARGIN_ACCEPTABLE',
        'FAIL',
        estimate.marginPct,
        `Expected margin is negative at ${estimate.marginPct.toFixed(1)}%.`,
      );
    else if (estimate.marginPct >= THRESHOLDS.minimumAcceptMarginPct)
      add(
        'MARGIN_ACCEPTABLE',
        'PASS',
        estimate.marginPct,
        `Expected margin ${estimate.marginPct.toFixed(1)}% meets the ${THRESHOLDS.minimumAcceptMarginPct}% minimum policy threshold.`,
      );
    else
      add(
        'MARGIN_ACCEPTABLE',
        'WARNING',
        estimate.marginPct,
        `Expected margin ${estimate.marginPct.toFixed(1)}% is positive but below the ${THRESHOLDS.minimumAcceptMarginPct}% policy threshold.`,
      );

    if (economics.sample.status === 'SUPPORTED')
      add(
        'HISTORICAL_SUPPORT',
        'PASS',
        economics.sample.count,
        `${economics.sample.count} comparable trips meet the shared SUPPORTED sample threshold of ${THRESHOLDS.supportedComparableTrips}.`,
      );
    else if (economics.sample.status === 'LIMITED')
      add(
        'HISTORICAL_SUPPORT',
        'WARNING',
        economics.sample.count,
        `${economics.sample.count} comparable trips are LIMITED; at least ${THRESHOLDS.supportedComparableTrips} are needed for stronger support.`,
      );
    else
      add(
        'HISTORICAL_SUPPORT',
        'WARNING',
        economics.sample.count,
        `Historical support is insufficient (${economics.sample.count} comparable trips).`,
      );

    const routeRule = performanceRule(
      'ROUTE_PERFORMANCE',
      performance.routeCommodity,
      'Route/commodity history',
      true,
    );
    rules.push(routeRule);
    rules.push(
      performance.selectedVehicle
        ? performanceRule(
            'VEHICLE_PERFORMANCE',
            performance.selectedVehicle,
            'Selected vehicle on matching loads',
            true,
          )
        : {
            code: 'VEHICLE_PERFORMANCE',
            result: 'NOT_AVAILABLE',
            severity: 'INFO',
            metric: null,
            explanation: 'No vehicle was selected, so vehicle-specific history is not evaluated.',
          },
    );
    rules.push(
      performance.customer
        ? performanceRule(
            'CUSTOMER_PERFORMANCE',
            performance.customer,
            'Selected customer on matching loads',
            false,
          )
        : {
            code: 'CUSTOMER_PERFORMANCE',
            result: 'NOT_AVAILABLE',
            severity: 'INFO',
            metric: null,
            explanation: 'No customer was selected, so customer-specific history is not evaluated.',
          },
    );
    rules.push(
      performance.sameQuarter.status === 'INSUFFICIENT_DATA'
        ? {
            code: 'SEASONALITY_CONTEXT',
            result: 'NOT_AVAILABLE',
            severity: 'INFO',
            metric: null,
            explanation:
              'There are too few comparable trips in the proposed calendar quarter for useful context.',
          }
        : {
            code: 'SEASONALITY_CONTEXT',
            result:
              performance.sameQuarter.averageProfit !== null &&
              performance.sameQuarter.averageProfit < 0
                ? 'WARNING'
                : 'PASS',
            severity:
              performance.sameQuarter.averageProfit !== null &&
              performance.sameQuarter.averageProfit < 0
                ? 'WARNING'
                : 'INFO',
            metric: performance.sameQuarter.averageProfit,
            explanation:
              performance.sameQuarter.averageProfit !== null &&
              performance.sameQuarter.averageProfit < 0
                ? `Comparable trips in this quarter averaged a loss of ${money(Math.abs(performance.sameQuarter.averageProfit))}; this is context, not a seasonal forecast.`
                : `Same-quarter historical average profit is ${money(performance.sameQuarter.averageProfit)} across ${performance.sameQuarter.sampleSize} trips. This is historical context, not a forecast.`,
          },
    );

    if (estimate.costPerKm === null || historical.averageCostPerKm === null)
      add(
        'COST_PER_KM',
        'NOT_AVAILABLE',
        null,
        'Expected or comparable historical cost/km is unavailable; this rule is not applied.',
      );
    else if (historical.averageCostPerKm <= 0)
      add(
        'COST_PER_KM',
        estimate.costPerKm <= 0 ? 'PASS' : 'WARNING',
        estimate.costPerKm,
        'Historical cost/km is zero or unavailable as a positive baseline; no ratio comparison is possible.',
      );
    else {
      const ratio = estimate.costPerKm / historical.averageCostPerKm;
      add(
        'COST_PER_KM',
        ratio <= THRESHOLDS.costPerKmWarningRatio ? 'PASS' : 'WARNING',
        round(ratio),
        `Expected cost/km is ${estimate.costPerKm.toFixed(2)} versus historical ${historical.averageCostPerKm.toFixed(2)} (${(ratio * 100).toFixed(0)}% of baseline; warning threshold ${THRESHOLDS.costPerKmWarningRatio * 100}%).`,
      );
    }

    const criticalWarnings = warnings.filter((item) => item.severity === 'CRITICAL');
    const blockingWarnings = warnings.filter((item) =>
      (THRESHOLDS.acceptBlockingWarningCodes as readonly string[]).includes(item.code),
    );
    const noncriticalWarnings = warnings.filter((item) => item.severity === 'WARNING');
    if (criticalWarnings.length)
      add(
        'DATA_QUALITY',
        'FAIL',
        criticalWarnings.map((item) => item.code).join(', '),
        `${criticalWarnings.length} critical data-quality warning(s) prevent an ACCEPT recommendation.`,
      );
    else if (noncriticalWarnings.length)
      add(
        'DATA_QUALITY',
        'WARNING',
        noncriticalWarnings.map((item) => item.code).join(', '),
        `${noncriticalWarnings.length} data-quality warning(s) are carried into this decision.`,
      );
    else
      add(
        'DATA_QUALITY',
        'PASS',
        'No warnings',
        'No data-quality warnings were returned by Load Economics.',
      );

    const historicalShare =
      historical.negativeProfitSharePct === null ? null : historical.negativeProfitSharePct / 100;
    const strongHistoricalLoss =
      economics.sample.status === 'SUPPORTED' &&
      historical.averageProfit !== null &&
      historical.averageProfit < 0 &&
      historicalShare !== null &&
      historicalShare >= THRESHOLDS.materiallyPoorHistoricalNegativeProfitShare;
    const strongVehicleLoss =
      performance.selectedVehicle?.status === 'SUPPORTED' &&
      performance.selectedVehicle.averageProfit !== null &&
      performance.selectedVehicle.averageProfit < 0 &&
      performance.selectedVehicle.negativeProfitShare !== null &&
      performance.selectedVehicle.negativeProfitShare / 100 >=
        THRESHOLDS.materiallyPoorHistoricalNegativeProfitShare;
    if (strongHistoricalLoss) {
      const rule = rules.find((item) => item.code === 'ROUTE_PERFORMANCE');
      if (rule)
        Object.assign(rule, {
          result: 'FAIL',
          severity: 'CRITICAL',
          explanation: `Supported route/commodity history averaged ${money(Math.abs(historical.averageProfit!))} loss and ${Math.round(historicalShare * 100)}% of priced trips lost money.`,
        });
    }
    if (strongVehicleLoss) {
      const rule = rules.find((item) => item.code === 'VEHICLE_PERFORMANCE');
      if (rule)
        Object.assign(rule, {
          result: 'FAIL',
          severity: 'CRITICAL',
          explanation: `Supported selected-vehicle history averaged ${money(Math.abs(performance.selectedVehicle!.averageProfit!))} loss and showed materially poor matching-load economics.`,
        });
    }

    const decisiveEconomicFailure =
      (estimate.profit !== null && estimate.profit < 0) ||
      (estimate.marginPct !== null && estimate.marginPct < THRESHOLDS.unacceptableMarginPct) ||
      strongHistoricalLoss ||
      strongVehicleLoss;
    const vehicleAcceptable =
      !performance.selectedVehicle ||
      rules.find((item) => item.code === 'VEHICLE_PERFORMANCE')?.result === 'PASS';
    const costPerKmAcceptable =
      rules.find((item) => item.code === 'COST_PER_KM')?.result !== 'WARNING';
    const recommendationAllowed = criticalWarnings.length === 0 && blockingWarnings.length === 0;
    const requiredRulesPass = [
      'PROFITABILITY_POSITIVE',
      'MARGIN_ACCEPTABLE',
      'HISTORICAL_SUPPORT',
      'ROUTE_PERFORMANCE',
    ].every((code) => rules.find((item) => item.code === code)?.result === 'PASS');
    const decision = decisiveEconomicFailure
      ? 'AVOID'
      : requiredRulesPass && vehicleAcceptable && costPerKmAcceptable && recommendationAllowed
        ? 'ACCEPT'
        : 'REVIEW';

    const evidenceLevel =
      economics.sample.count < THRESHOLDS.limitedComparableTrips || estimate.profit === null
        ? 'INSUFFICIENT_EVIDENCE'
        : economics.sample.status === 'LIMITED'
          ? 'LIMITED_EVIDENCE'
          : economics.sample.status === 'SUPPORTED' &&
              warnings.length === 0 &&
              rules.find((item) => item.code === 'ROUTE_PERFORMANCE')?.result === 'PASS' &&
              vehicleAcceptable
            ? 'STRONG_EVIDENCE'
            : 'MODERATE_EVIDENCE';
    const historicalMargin = economics.benchmark.averageHistoricalMarginPct;
    const marginDifference =
      estimate.marginPct !== null && historicalMargin !== null
        ? round(estimate.marginPct - historicalMargin)
        : null;
    const explanation = this.explain(
      decision,
      economics,
      marginDifference,
      evidenceLevel,
      warnings,
    );
    const limitations = [
      'This is deterministic business decision support, not an AI/ML model or a guarantee.',
      'Profit and cost estimates use recorded comparable-trip data; unrecorded costs may be missing.',
      'Historical route/vehicle/customer outcomes do not guarantee this proposed load will perform similarly.',
      'Demand forecasting is not used as a direct profit prediction.',
      ...(warnings.length ? warnings.map((item) => item.explanation) : []),
    ];
    const result = {
      proposedLoad: economics.input,
      decision,
      recommendation: `FleetNexus recommends ${decision}. The owner remains responsible for the final decision.`,
      evidenceLevel,
      expectedRevenue: estimate.revenue,
      expectedCost: estimate.costs,
      expectedProfit: estimate.profit,
      expectedMarginPct: estimate.marginPct,
      costPerKm: estimate.costPerKm,
      profitPerKm: estimate.profitPerKm,
      comparableTripCount: economics.sample.count,
      historicalBenchmarks: {
        averageProfit: historical.averageProfit,
        medianProfit: historical.medianProfit,
        averageMarginPct: historical.averageMarginPct,
        averageCost: historical.averageTotalCost,
        averageCostPerKm: historical.averageCostPerKm,
        negativeProfitSharePct: historical.negativeProfitSharePct,
        proposedMarginDifferencePoints: marginDifference,
        performance,
        explanation:
          marginDifference === null
            ? 'Historical margin comparison is unavailable.'
            : `Expected margin is ${Math.abs(marginDifference).toFixed(1)} percentage points ${marginDifference >= 0 ? 'above' : 'below'} the comparable-trip average. Past performance is not a guarantee.`,
      },
      dataSufficiency: economics.sample,
      dataQuality: warnings,
      rules,
      explanation,
      limitations,
      economics,
    };
    const analyzedAt = new Date();
    const prediction = await this.prisma.loadPrediction.create({
      data: {
        organizationId,
        decision,
        inputSnapshot: structuredClone(input) as never,
        predictionSnapshot: structuredClone({
          ...result,
          analyzedAt,
          predictionVersion: 'decision-support-v1',
        }) as never,
        analyzedAt,
      },
      select: { id: true },
    });
    return {
      ...result,
      predictionId: prediction.id,
      analyzedAt,
      predictionVersion: 'decision-support-v1',
    };
  }

  private explain(
    decision: string,
    economics: Awaited<ReturnType<LoadProfitabilityService['analyze']>>,
    marginDifference: number | null,
    evidenceLevel: string,
    warnings: Array<{ code: string; explanation: string }>,
  ) {
    const profit = economics.estimate.profit;
    const margin = economics.estimate.marginPct;
    const count = economics.sample.count;
    const status = economics.sample.status.toLowerCase();
    if (decision === 'AVOID') {
      if (profit !== null && profit < 0)
        return `FleetNexus recommends AVOID because expected cost of ${money(economics.estimate.costs.total)} exceeds expected revenue of ${money(economics.estimate.revenue.amount)}; estimated loss is ${money(Math.abs(profit))}. The comparison uses ${count} comparable trips (${status} evidence). Review the listed cost and data-quality assumptions before making a final decision.`;
      return `FleetNexus recommends AVOID because supported historical route or selected-vehicle evidence shows materially poor profitability across ${count} comparable trips. This recommendation is based on recorded FleetNexus history, not a guarantee.`;
    }
    if (decision === 'ACCEPT') {
      const marginText =
        marginDifference === null
          ? `Expected margin is ${margin?.toFixed(1)}%.`
          : `Expected margin is ${margin?.toFixed(1)}%, ${Math.abs(marginDifference).toFixed(1)} percentage points ${marginDifference >= 0 ? 'above' : 'below'} the historical comparable average.`;
      return `FleetNexus recommends ACCEPT: expected profit is ${money(profit)} with a ${margin?.toFixed(1)}% margin. ${marginText} The analysis is supported by ${count} comparable trips and passes the configured route, margin, cost/km, and data-quality rules. The owner remains responsible for the final decision; this is not a guarantee of future results.`;
    }
    const reasons: string[] = [];
    if (profit !== null && profit > 0)
      reasons.push(`expected profit is positive at ${money(profit)}`);
    if (margin !== null && margin >= 0 && margin < THRESHOLDS.minimumAcceptMarginPct)
      reasons.push(
        `expected margin ${margin.toFixed(1)}% is below the ${THRESHOLDS.minimumAcceptMarginPct}% policy threshold`,
      );
    if (economics.sample.status !== 'SUPPORTED')
      reasons.push(`historical evidence is ${status} with ${count} comparable trips`);
    if (warnings.length) reasons.push(`${warnings.length} data-quality warning(s) require review`);
    if (!reasons.length)
      reasons.push(`the available evidence level is ${evidenceLevel.toLowerCase()}`);
    return `FleetNexus recommends REVIEW because ${reasons.join('; ')}. Compare the proposed ${money(profit)} profit and ${margin === null ? 'unavailable' : `${margin.toFixed(1)}%`} margin with the historical benchmark, then verify the listed assumptions before acceptance.`;
  }
}

function performanceRule(
  code: string,
  metric: {
    sampleSize: number;
    status: string;
    averageProfit: number | null;
    averageMarginPct: number | null;
    negativeProfitShare: number | null;
  },
  label: string,
  avoidIfPoor: boolean,
): Rule {
  if (metric.status === 'INSUFFICIENT_DATA')
    return {
      code,
      result: 'WARNING',
      severity: 'WARNING',
      metric: metric.sampleSize,
      explanation: `${label} history has only ${metric.sampleSize} priced observations; performance is uncertain.`,
    };
  const poor =
    metric.status === 'SUPPORTED' &&
    metric.averageProfit !== null &&
    metric.averageProfit < 0 &&
    metric.negativeProfitShare !== null &&
    metric.negativeProfitShare / 100 >= THRESHOLDS.materiallyPoorHistoricalNegativeProfitShare;
  if (poor && avoidIfPoor)
    return {
      code,
      result: 'FAIL',
      severity: 'CRITICAL',
      metric: metric.averageProfit,
      explanation: `${label} history shows materially poor profitability: average loss ${money(Math.abs(metric.averageProfit!))} with ${Math.round(metric.negativeProfitShare!)}% of trips unprofitable.`,
    };
  if (poor)
    return {
      code,
      result: 'WARNING',
      severity: 'WARNING',
      metric: metric.averageProfit,
      explanation: `${label} history is materially poor; average loss is ${money(Math.abs(metric.averageProfit!))}.`,
    };
  if (
    metric.status === 'SUPPORTED' &&
    metric.averageProfit !== null &&
    metric.averageProfit > 0 &&
    metric.averageMarginPct !== null &&
    metric.averageMarginPct >= THRESHOLDS.minimumAcceptMarginPct
  )
    return {
      code,
      result: 'PASS',
      severity: 'INFO',
      metric: metric.averageMarginPct,
      explanation: `${label} has ${metric.sampleSize} priced observations, average profit ${money(metric.averageProfit)}, and average margin ${metric.averageMarginPct.toFixed(1)}%.`,
    };
  return {
    code,
    result: 'WARNING',
    severity: 'WARNING',
    metric: metric.averageMarginPct,
    explanation: `${label} performance is borderline or based on a limited sample (${metric.sampleSize} observations; average profit ${money(metric.averageProfit)}, margin ${metric.averageMarginPct?.toFixed(1) ?? 'unavailable'}%).`,
  };
}

function money(value: number | null) {
  return value === null
    ? 'unavailable'
    : `₹${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
