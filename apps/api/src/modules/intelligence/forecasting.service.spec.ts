import { BadRequestException } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';

describe('ForecastingService', () => {
  const demand = (length: number) =>
    Array.from({ length }, (_, i) => ({
      year: 2021 + Math.floor(i / 12),
      month: (i % 12) + 1,
      tripCount: i % 6 === 0 ? 0 : 4 + (i % 3),
    }));
  const makeService = (series = demand(36)) =>
    new ForecastingService({
      getDemandHistory: jest.fn().mockResolvedValue({
        label: 'Grain',
        commodityId: 'commodity',
        routeId: null,
        tripCount: series.reduce((n, p) => n + p.tripCount, 0),
        series,
      }),
    } as never);

  it('backtests chronologically and selects the lowest supported MAE', async () => {
    const result = await makeService().forecast('org', 'commodity', undefined, {
      year: 2024,
      month: 1,
      horizon: 1,
    });
    expect(result.backtest.method).toBe('EXPANDING_WINDOW');
    expect(result.backtest.metrics).toHaveLength(4);
    expect(result.backtest.selectedMethod).toBeTruthy();
    expect(result.forecast?.points[0]).toMatchObject({ year: 2024, month: 1 });
  });

  it('returns insufficient-data status and no selected forecast for short history', async () => {
    const result = await makeService(demand(8)).forecast('org', 'commodity', undefined, {});
    expect(result.dataSufficiency.status).toBe('INSUFFICIENT_DATA');
    expect(result.forecast).toBeNull();
  });

  it('reports zero-actual counts and keeps percentage error null when all holdouts are zero', async () => {
    const allZero = Array.from({ length: 24 }, (_, i) => ({
      year: 2022 + Math.floor(i / 12),
      month: (i % 12) + 1,
      tripCount: 0,
    }));
    const result = await makeService(allZero).forecast('org', 'commodity', undefined, {});
    for (const metric of result.backtest.metrics) {
      if (metric.backtestPredictions) expect(metric.mape).toBeNull();
      expect(metric.zeroActualObservations).toBe(metric.backtestPredictions);
    }
  });

  it('requires forecast target year and month together and rejects targets within history', async () => {
    const service = makeService();
    await expect(service.forecast('org', 'commodity', undefined, { year: 2024 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.forecast('org', 'commodity', undefined, { year: 2023, month: 12 }),
    ).rejects.toThrow(BadRequestException);
  });
});
