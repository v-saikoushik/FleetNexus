import { DecisionSupportService } from './decision-support.service';

function makeEconomics(overrides: Record<string, unknown> = {}) {
  const route = {
    sampleSize: 20,
    status: 'SUPPORTED',
    averageProfit: 3_500,
    averageMarginPct: 20,
    negativeProfitCount: 2,
    negativeProfitShare: 10,
    averageCostPerKm: 11,
  };
  const vehicle = {
    sampleSize: 18,
    status: 'SUPPORTED',
    averageProfit: 3_200,
    averageMarginPct: 19,
    negativeProfitCount: 1,
    negativeProfitShare: 6,
    averageCostPerKm: 10.5,
  };
  return {
    input: { offeredFreight: 20_000 },
    analysisStatus: 'SUPPORTED',
    estimate: {
      revenue: { amount: 20_000, basis: 'PROVIDED' },
      costs: { total: 15_000, basis: 'recorded' },
      profit: 5_000,
      marginPct: 25,
      costPerKm: 10,
      profitPerKm: 3.33,
    },
    historical: {
      comparableTripCount: 20,
      averageProfit: 3_500,
      medianProfit: 3_000,
      averageMarginPct: 20,
      averageTotalCost: 16_000,
      averageCostPerKm: 11,
      negativeProfitSharePct: 10,
    },
    benchmark: { averageHistoricalMarginPct: 20 },
    sample: { count: 20, status: 'SUPPORTED', explanation: 'supported' },
    performance: {
      routeCommodity: route,
      selectedVehicle: vehicle,
      customer: null,
      sameQuarter: { sampleSize: 8, status: 'LIMITED', averageProfit: 2_000, averageMarginPct: 15 },
      explanation: 'historical context',
    },
    dataQuality: [],
    ...overrides,
  };
}

describe('DecisionSupportService', () => {
  const makeService = (economics = makeEconomics()) => {
    const loadProfitability = { analyze: jest.fn().mockResolvedValue(economics) };
    const prisma = {
      loadPrediction: { create: jest.fn().mockResolvedValue({ id: 'prediction-1' }) },
    };
    return {
      service: new DecisionSupportService(loadProfitability as never, prisma as never),
      loadProfitability,
      prisma,
    };
  };
  const input = {
    routeId: 'route',
    commodityId: 'commodity',
    offeredFreight: 20_000,
    proposedPickupDate: '2026-01-15',
  };

  it('reuses Load Economics and accepts only with positive economics, supported history, acceptable margin and clean rules', async () => {
    const economics = makeEconomics();
    const { service, loadProfitability, prisma } = makeService(economics);
    const result = await service.analyze('org-1', input);
    expect(loadProfitability.analyze).toHaveBeenCalledWith('org-1', input);
    expect(result.decision).toBe('ACCEPT');
    expect(result.predictionId).toBe('prediction-1');
    expect(result.predictionVersion).toBe('decision-support-v1');
    expect(result.analyzedAt).toBeInstanceOf(Date);
    expect(prisma.loadPrediction.create).toHaveBeenCalledTimes(1);
    expect(result.evidenceLevel).toBe('STRONG_EVIDENCE');
    expect(result.rules.find((rule) => rule.code === 'PROFITABILITY_POSITIVE')?.result).toBe(
      'PASS',
    );
    expect(result.rules.find((rule) => rule.code === 'VEHICLE_PERFORMANCE')?.result).toBe('PASS');
    expect(result.explanation).toContain('₹5,000');
    expect(result.explanation).toContain('25.0%');
  });

  it('reviews positive but borderline economics and limited historical support', async () => {
    const economics = makeEconomics({
      estimate: {
        revenue: { amount: 20_000, basis: 'PROVIDED' },
        costs: { total: 19_000 },
        profit: 1_000,
        marginPct: 5,
        costPerKm: 10,
        profitPerKm: 1,
      },
      sample: { count: 5, status: 'LIMITED', explanation: 'limited' },
      performance: {
        routeCommodity: {
          sampleSize: 5,
          status: 'LIMITED',
          averageProfit: 1_000,
          averageMarginPct: 9,
          negativeProfitCount: 1,
          negativeProfitShare: 20,
          averageCostPerKm: 11,
        },
        selectedVehicle: null,
        customer: null,
        sameQuarter: {
          sampleSize: 1,
          status: 'INSUFFICIENT_DATA',
          averageProfit: null,
          averageMarginPct: null,
        },
        explanation: 'context',
      },
      dataQuality: [{ code: 'LOW_SAMPLE_SIZE', severity: 'WARNING', explanation: 'Only 5 trips.' }],
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.decision).toBe('REVIEW');
    expect(result.evidenceLevel).toBe('LIMITED_EVIDENCE');
    expect(result.rules.find((rule) => rule.code === 'MARGIN_ACCEPTABLE')?.result).toBe('WARNING');
    expect(result.explanation).toContain('5 comparable trips');
  });

  it('avoids a load with negative expected profit and identifies economic failure', async () => {
    const economics = makeEconomics({
      estimate: {
        revenue: { amount: 12_000, basis: 'PROVIDED' },
        costs: { total: 15_000 },
        profit: -3_000,
        marginPct: -25,
        costPerKm: 10,
        profitPerKm: -2,
      },
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.decision).toBe('AVOID');
    expect(result.rules.find((rule) => rule.code === 'PROFITABILITY_POSITIVE')?.result).toBe(
      'FAIL',
    );
    expect(result.explanation).toContain('estimated loss is ₹3,000');
  });

  it('reviews when core estimate evidence is insufficient instead of issuing a confident acceptance', async () => {
    const economics = makeEconomics({
      sample: { count: 2, status: 'INSUFFICIENT_DATA', explanation: 'none' },
      estimate: {
        revenue: { amount: 20_000, basis: 'PROVIDED' },
        costs: { total: null },
        profit: null,
        marginPct: null,
        costPerKm: null,
        profitPerKm: null,
      },
      performance: {
        routeCommodity: {
          sampleSize: 2,
          status: 'INSUFFICIENT_DATA',
          averageProfit: null,
          averageMarginPct: null,
          negativeProfitCount: 0,
          negativeProfitShare: null,
          averageCostPerKm: null,
        },
        selectedVehicle: null,
        customer: null,
        sameQuarter: {
          sampleSize: 0,
          status: 'INSUFFICIENT_DATA',
          averageProfit: null,
          averageMarginPct: null,
        },
        explanation: '',
      },
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.decision).toBe('REVIEW');
    expect(result.evidenceLevel).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('avoids supported route history with consistently poor profitability', async () => {
    const economics = makeEconomics({
      historical: {
        comparableTripCount: 20,
        averageProfit: -500,
        medianProfit: -400,
        averageMarginPct: -5,
        averageTotalCost: 16_000,
        averageCostPerKm: 11,
        negativeProfitSharePct: 80,
      },
      performance: {
        routeCommodity: {
          sampleSize: 20,
          status: 'SUPPORTED',
          averageProfit: -500,
          averageMarginPct: -5,
          negativeProfitCount: 16,
          negativeProfitShare: 80,
          averageCostPerKm: 11,
        },
        selectedVehicle: null,
        customer: null,
        sameQuarter: { sampleSize: 0, status: 'INSUFFICIENT_DATA', averageProfit: null },
        explanation: '',
      },
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.decision).toBe('AVOID');
    expect(result.rules.find((rule) => rule.code === 'ROUTE_PERFORMANCE')?.result).toBe('FAIL');
  });

  it('returns NOT_AVAILABLE for absent vehicle evidence and warns on materially higher cost/km', async () => {
    const economics = makeEconomics({
      historical: {
        comparableTripCount: 20,
        averageProfit: 3_500,
        medianProfit: 3_000,
        averageMarginPct: 20,
        averageTotalCost: 16_000,
        averageCostPerKm: 7,
        negativeProfitSharePct: 10,
      },
      performance: {
        routeCommodity: {
          sampleSize: 20,
          status: 'SUPPORTED',
          averageProfit: 3_500,
          averageMarginPct: 20,
          negativeProfitCount: 2,
          negativeProfitShare: 10,
          averageCostPerKm: 7,
        },
        selectedVehicle: null,
        customer: null,
        sameQuarter: { sampleSize: 0, status: 'INSUFFICIENT_DATA', averageProfit: null },
        explanation: '',
      },
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.rules.find((rule) => rule.code === 'VEHICLE_PERFORMANCE')?.result).toBe(
      'NOT_AVAILABLE',
    );
    expect(result.rules.find((rule) => rule.code === 'COST_PER_KM')?.result).toBe('WARNING');
    expect(result.decision).toBe('REVIEW');
  });

  it('does not accept when Load Economics reports a critical data-quality failure', async () => {
    const economics = makeEconomics({
      dataQuality: [
        { code: 'MISSING_FUEL_DATA', severity: 'WARNING', explanation: 'Fuel missing' },
      ],
    });
    const result = await makeService(economics).service.analyze('org-1', input);
    expect(result.decision).toBe('REVIEW');
    expect(result.rules.find((rule) => rule.code === 'DATA_QUALITY')?.result).toBe('FAIL');
    expect(result.dataQuality[0].severity).toBe('CRITICAL');
  });
});
