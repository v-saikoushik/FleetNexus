import { BadRequestException, Injectable } from '@nestjs/common';
import { SeasonalityService } from './seasonality.service';
import type { ForecastQueryDto } from './dto/forecast-query.dto';

const MIN_MONTHS = 24;
const MIN_TRIPS = 24;
const LIMITED_TRIPS = 12;
const MIN_BACKTEST = 3;
const MONTH_NAMES = [
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
type Point = { year: number; month: number; tripCount: number };
type Method = {
  code: string;
  label: string;
  explain: string;
  predict: (history: number[], month: number) => number | null;
};

@Injectable()
export class ForecastingService {
  constructor(private readonly seasonality: SeasonalityService) {}

  async forecast(
    orgId: string,
    commodityId: string,
    routeId: string | undefined,
    query: ForecastQueryDto = {},
  ) {
    const history = await this.seasonality.getDemandHistory(orgId, {
      commodityId,
      ...(routeId ? { routeId } : {}),
    });
    const series = history.series as Point[];
    const values = series.map((point) => point.tripCount);
    const years = new Set(series.map((point) => point.year)).size;
    const status =
      series.length >= MIN_MONTHS && years >= 2 && history.tripCount >= MIN_TRIPS
        ? 'SUPPORTED'
        : series.length >= 12 && years >= 2 && history.tripCount >= LIMITED_TRIPS
          ? 'LIMITED'
          : 'INSUFFICIENT_DATA';
    const methods: Method[] = [
      {
        code: 'HISTORICAL_MEAN',
        label: 'Historical mean',
        explain: 'Mean of all earlier monthly counts in the training window.',
        predict: (h) => (h.length ? avg(h) : null),
      },
      {
        code: 'SEASONAL_MEAN',
        label: 'Same-month seasonal mean',
        explain:
          'Mean of earlier observations for the target calendar month; requires two prior comparable years.',
        predict: (h, month) => {
          const matching = h.filter((_, i) => series[i]?.month === month);
          return matching.length >= 2 ? avg(matching) : null;
        },
      },
      {
        code: 'PREVIOUS_COMPARABLE_PERIOD',
        label: 'Previous comparable period',
        explain:
          'Uses the latest available actual count for the same calendar month in an earlier year.',
        predict: (h, month) => {
          const indices = h.map((_, i) => i).filter((i) => series[i]?.month === month);
          return indices.length ? h[indices[indices.length - 1]] : null;
        },
      },
      {
        code: 'MOVING_AVERAGE_3',
        label: 'Three-month moving average',
        explain: 'Mean of the three most recent observed or recursively forecast months.',
        predict: (h) => (h.length >= 3 ? avg(h.slice(-3)) : null),
      },
    ];
    const evaluations = methods.map((method) => {
      const errors: number[] = [];
      const absErrors: number[] = [];
      const nonzeroPct: number[] = [];
      for (let i = Math.min(12, values.length); i < values.length; i++) {
        const prediction = method.predict(values.slice(0, i), series[i].month);
        if (prediction == null) continue;
        const error = prediction - values[i];
        errors.push(error);
        absErrors.push(Math.abs(error));
        if (values[i] > 0) nonzeroPct.push((Math.abs(error) / values[i]) * 100);
      }
      const mae = errors.length ? avg(absErrors) : null;
      return {
        code: method.code,
        label: method.label,
        explanation: method.explain,
        backtestPredictions: errors.length,
        mae: round(mae),
        rmse: errors.length ? round(Math.sqrt(avg(errors.map((e) => e * e)))) : null,
        mape: nonzeroPct.length ? round(avg(nonzeroPct)) : null,
        zeroActualObservations: errors.length - nonzeroPct.length,
      };
    });
    const eligible =
      status !== 'INSUFFICIENT_DATA'
        ? evaluations.filter(
            (item) => item.backtestPredictions >= MIN_BACKTEST && item.mae !== null,
          )
        : [];
    const selected = [...eligible].sort((a, b) => a.mae! - b.mae!)[0];
    const now = new Date();
    const defaultDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const latestOrdinal = series.length ? series.at(-1)!.year * 12 + series.at(-1)!.month - 1 : -1;
    const defaultOrdinal = Math.max(
      defaultDate.getUTCFullYear() * 12 + defaultDate.getUTCMonth(),
      latestOrdinal + 1,
    );
    const targetOrdinal =
      query.year !== undefined && query.month !== undefined
        ? query.year * 12 + query.month - 1
        : defaultOrdinal;
    const targetYear = Math.floor(targetOrdinal / 12);
    const targetMonth = (targetOrdinal % 12) + 1;
    if ((query.year == null) !== (query.month == null))
      throw new BadRequestException('year and month must be provided together');
    if (query.year !== undefined && targetOrdinal <= latestOrdinal)
      throw new BadRequestException('Forecast target must be later than the latest observed month');
    const forecastValues: number[] = [];
    if (selected) {
      const method = methods.find((item) => item.code === selected.code)!;
      const train = [...values];
      let currentOrdinal = latestOrdinal;
      while (currentOrdinal < targetOrdinal + (query.horizon ?? 1) - 1) {
        currentOrdinal += 1;
        const month = (currentOrdinal % 12) + 1;
        const value = method.predict(train, month);
        if (value == null) break;
        const nonnegative = Math.max(0, value);
        if (currentOrdinal >= targetOrdinal) forecastValues.push(round(nonnegative) ?? 0);
        train.push(nonnegative);
      }
    }
    const forecast = forecastValues.map((tripCount, index) => {
      const ordinal = targetYear * 12 + targetMonth - 1 + index;
      const year = Math.floor(ordinal / 12);
      const month = (ordinal % 12) + 1;
      return { year, month, monthLabel: MONTH_NAMES[month - 1], tripCount };
    });
    const rangeError = selected ? selected.mae : null;
    const range =
      rangeError === null
        ? null
        : {
            type: 'EMPIRICAL_BACKTEST_RANGE',
            lower: round(Math.max(0, (forecastValues[0] ?? 0) - rangeError)),
            upper: round((forecastValues[0] ?? 0) + rangeError),
            explanation:
              'Range uses selected model backtest MAE around the point forecast; it is an empirical error band, not a confidence interval.',
          };
    return {
      entity: {
        id: history.routeId ? `${history.routeId}:${history.commodityId}` : history.commodityId,
        label: history.label,
        routeId: history.routeId,
        commodityId: history.commodityId,
      },
      target: { year: targetYear, month: targetMonth, monthLabel: MONTH_NAMES[targetMonth - 1] },
      dataSufficiency: {
        status,
        completedTrips: history.tripCount,
        observedMonths: series.length,
        distinctYears: years,
        zeroDemandMonths: values.filter((v) => v === 0).length,
        continuousMonthlySeries: true,
        minimumMonths: MIN_MONTHS,
        minimumComparableTrips: MIN_TRIPS,
        explanation:
          status === 'SUPPORTED'
            ? 'At least 24 continuous month buckets across two or more calendar years are available.'
            : status === 'LIMITED'
              ? 'History supports exploratory output but does not meet the 24-month support threshold.'
              : 'At least 12 continuous month buckets across two years are required; no forecast is selected below this threshold.',
      },
      backtest: {
        method: 'EXPANDING_WINDOW',
        minimumTrainingMonths: 12,
        minimumPredictionsForSelection: MIN_BACKTEST,
        metrics: evaluations,
        selectionMetric: 'MAE',
        selectedMethod: selected?.code ?? null,
        explanation:
          'Each prediction uses only months earlier than its held-out target. Models with fewer than three valid predictions are not selectable.',
      },
      forecast:
        selected && status !== 'INSUFFICIENT_DATA'
          ? {
              method: selected.code,
              points: forecast,
              empiricalRange: range,
              explanation:
                'Forecast is based only on completed-trip history recorded in this FleetNexus organization.',
            }
          : null,
      limitations: [
        'Forecasts represent trip counts, not freight revenue or profit.',
        'Historical zero buckets are inserted only between the first and last month with matching completed trips.',
        'Backtest metrics describe past holdout errors and do not guarantee future accuracy.',
        ...(status === 'LIMITED' ? ['History is limited; treat the forecast as exploratory.'] : []),
      ],
    };
  }

  async evaluation(orgId: string, commodityId: string, routeId?: string) {
    const result = await this.forecast(orgId, commodityId, routeId, { horizon: 1 });
    return {
      entity: result.entity,
      dataSufficiency: result.dataSufficiency,
      backtest: result.backtest,
    };
  }

  async overview(orgId: string) {
    const overview = await this.seasonality.getOverview(orgId);
    return {
      explanation:
        'Forecastable targets are derived from completed-trip history. Select a target to check its history and backtest support.',
      commodities: overview.commodities.map((item) => ({
        id: item.id,
        label: item.label,
        historicalTripCount: item.historicalTripCount,
        observedMonths: item.observedMonths,
        yearsObserved: item.yearsObserved,
      })),
      routeCommodities: overview.routeCommodities.map((item) => ({
        routeId: item.routeId,
        routeLabel: item.routeLabel,
        commodityId: item.commodityId,
        commodityName: item.commodityName,
        historicalTripCount: item.historicalTripCount,
        observedMonths: item.observedMonths,
        yearsObserved: item.yearsObserved,
      })),
    };
  }
}
function avg(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function round(value: number | null) {
  return value === null ? null : Math.round(value * 100) / 100;
}
