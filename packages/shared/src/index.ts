/**
 * Shared constants and types for FleetNexus.
 * Keep this package free of framework-specific dependencies.
 * Used by both backend (NestJS) and frontend (React).
 */

export const APP_NAME = 'FleetNexus' as const;

// ─── Role System ─────────────────────────────────────────────────────────────

export const ROLES = [
  'SUPER_ADMIN',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'FLEET_OWNER',
  'DRIVER',
] as const;

export type Role = (typeof ROLES)[number];

// ─── Organization Types ──────────────────────────────────────────────────────

export const ORGANIZATION_TYPES = ['FACTORY', 'UNION', 'FLEET_OWNER'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const VEHICLE_TYPES = [
  'TRUCK',
  'TRAILER',
  'TANKER',
  'TIPPER',
  'CONTAINER',
  'PICKUP',
  'MINI_TRUCK',
  'OTHER',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const FUEL_TYPES = ['DIESEL', 'PETROL', 'CNG', 'LNG', 'ELECTRIC', 'OTHER'] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

// ─── Finance Enums ────────────────────────────────────────────────────────────

export const EXPENSE_TYPES = [
  'FUEL',
  'TOLL',
  'DRIVER_ALLOWANCE',
  'DRIVER_SALARY',
  'MAINTENANCE',
  'REPAIRS',
  'TYRES',
  'INSURANCE',
  'PERMIT_TAX',
  'LOADING',
  'UNLOADING',
  'COMMISSION',
  'PARKING',
  'FOOD_ALLOWANCE',
  'OTHER',
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const RATE_BASIS_OPTIONS = ['PER_TON', 'PER_TRIP', 'PER_KM', 'FLAT', 'OTHER'] as const;

export type RateBasis = (typeof RATE_BASIS_OPTIONS)[number];

export const TRIP_STATUSES = [
  'PLANNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED'] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ─── Finance Metric Shapes ────────────────────────────────────────────────────

export type FinancePeriod = {
  startDate: string; // ISO date string
  endDate: string;
};

export type RevenueMetrics = {
  earned: number;
  received: number;
  outstanding: number;
};

export type ExpenseBreakdown = {
  total: number;
  fuel: number;
  toll: number;
  driver: number;
  maintenance: number;
  loading: number;
  unloading: number;
  commission: number;
  other: number;
};

export type FinanceSummary = {
  period: FinancePeriod;
  revenue: RevenueMetrics;
  expenses: ExpenseBreakdown;
  profit: {
    estimated: number | null;
    actual: number | null;
  };
  metrics: {
    tripCount: number;
    totalKm: number | null;
    avgProfitPerTrip: number | null;
    avgProfitPerKm: number | null;
    marginPct: number | null;
  };
};

export const FINANCE_PERIODS = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type FinancePeriodType = (typeof FINANCE_PERIODS)[number];

export type FinanceReportPeriod = {
  period: FinancePeriodType;
  startDate: string;
  endDate: string;
};

export type FinanceDashboardSummary = {
  period: FinanceReportPeriod;
  revenue: { total: number; tripCount: number; averagePerTrip: number | null };
  cashReceived: number;
  outstanding: number | null;
  expenses: { total: number; count: number; byCategory: Record<ExpenseType, number> };
  profit: number | null;
  profitMarginPct: number | null;
  costPerKm: number | null;
  profitPerKm: number | null;
  revenueVsExpenses: { revenue: number; expenses: number };
  financialFinalization: {
    finalized: { tripCount: number; revenue: number; recordedExpenses: number; profit: number };
    unfinalized: { tripCount: number; revenue: number; recordedExpenses: number; profit: number };
  };
};

export type FinanceVehicleProfitability = {
  vehicleId: string;
  registrationNumber: string;
  tripCount: number;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  profitMarginPct: number | null;
  fuelCost: number;
  costPerKm: number | null;
  revenuePerKm: number | null;
  profitPerKm: number | null;
};

export type FinanceTripProfitability = {
  tripId: string;
  tripNumber: string;
  startDate: string;
  vehicleId: string;
  vehicleRegistrationNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  revenue: number | null;
  costs: number;
  profit: number | null;
  marginPct: number | null;
  costPerKm: number | null;
  distanceKm: number | null;
};

export type FinanceExpenseEntry = {
  id: string;
  type: ExpenseType;
  amount: number;
  date: string;
  description: string | null;
  referenceNumber: string | null;
  tripId: string | null;
  tripNumber: string | null;
  vehicleId: string | null;
  vehicleRegistrationNumber: string | null;
};

export type FinanceOutstandingItem = {
  tripId: string;
  tripNumber: string;
  customerId: string | null;
  customerName: string | null;
  revenue: number;
  received: number;
  outstanding: number;
};

export type FinanceCashFlowBucket = {
  label: string;
  startDate: string;
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
};

export type FinanceCashFlowReport = {
  period: FinanceReportPeriod;
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
  basis: 'Operational cash flow from recorded payments and costs; not double-entry accounting.';
  buckets: FinanceCashFlowBucket[];
};

export type FinanceInsight = {
  type: 'LARGEST_EXPENSE_CATEGORY' | 'MAINTENANCE_INCREASE' | 'VEHICLE_COST_PER_KM';
  message: string;
  currentValue: number;
  baselineValue: number | null;
  unit: 'INR' | 'INR_PER_KM';
};

export type BusinessMemoryConfidence = 'INSUFFICIENT' | 'LIMITED' | 'SUPPORTED';

export const BUSINESS_MEMORY_SAMPLE_THRESHOLDS = { limited: 3, supported: 10 } as const;

export const LOAD_PROFITABILITY_THRESHOLDS = {
  insufficientBelow: 3,
  limitedBelow: 15,
  supportedFrom: 15,
  minimumComponentSamples: 3,
  recentTripLimit: 10,
  similarDistanceFraction: 0.2,
  similarDistanceFloorKm: 50,
  similarCapacityToleranceTons: 2,
} as const;

export type BusinessMemoryEntityHistory = {
  entityId: string;
  label: string;
  tripCount: number;
  pricedTripCount: number;
  totalRevenue: number | null;
  totalPaymentsReceived: number;
  outstanding: number | null;
  totalExpenses: number;
  totalProfit: number | null;
  averageFreightPerTrip: number | null;
  averageProfitPerTrip: number | null;
  averageMarginPct: number | null;
  averageCostPerKm: number | null;
  fuelCost: number;
  commodities: string[];
  routes: string[];
  customers: string[];
  vehicles: string[];
  tripDates: string[];
  recentTrips: BusinessMemoryTrip[];
  confidence: BusinessMemoryConfidence;
  explanation: string;
};

export type BusinessMemoryFreightHistory = {
  customerId: string | null;
  customerName: string | null;
  routeId: string;
  routeLabel: string;
  commodityId: string;
  commodityName: string | null;
  comparableTripCount: number;
  minimumFreight: number | null;
  maximumFreight: number | null;
  averageFreight: number | null;
  mostRecentFreight: number | null;
  averageProfit: number | null;
  averageMarginPct: number | null;
  recordedRateCount: number;
  confidence: BusinessMemoryConfidence;
  explanation: string;
  recentTrips: BusinessMemoryTrip[];
};

export const COST_INTELLIGENCE_THRESHOLDS = {
  minimumTrips: BUSINESS_MEMORY_SAMPLE_THRESHOLDS.limited,
  highCostPerKmRatio: 1.15,
  lowProfitMarginPct: 10,
  highExpenseRatioPct: 90,
  lowTripProfitRatio: 0.5,
  fuelCostPerKmRatio: 1.2,
  highMaintenanceSharePct: 35,
  highExpenseCategorySharePct: 40,
  highTollRouteSharePct: 25,
} as const;

export const DECISION_SUPPORT_THRESHOLDS = {
  minimumAcceptMarginPct: COST_INTELLIGENCE_THRESHOLDS.lowProfitMarginPct,
  unacceptableMarginPct: 0,
  supportedComparableTrips: LOAD_PROFITABILITY_THRESHOLDS.supportedFrom,
  limitedComparableTrips: LOAD_PROFITABILITY_THRESHOLDS.insufficientBelow,
  costPerKmWarningRatio: COST_INTELLIGENCE_THRESHOLDS.highCostPerKmRatio,
  materiallyPoorHistoricalNegativeProfitShare: 0.75,
  minimumPerformanceSamples: LOAD_PROFITABILITY_THRESHOLDS.minimumComponentSamples,
  criticalDataQualityCodes: ['NO_COMPARABLE_TRIPS', 'MISSING_EXPENSE_HISTORY', 'MISSING_FUEL_DATA'] as const,
  acceptBlockingWarningCodes: ['ESTIMATED_FREIGHT', 'LIMITED_VEHICLE_HISTORY'] as const,
} as const;

export const SEASONALITY_THRESHOLDS = {
  minimumTrips: 10,
  minimumYears: 2,
  minimumMonthOfYearValues: 3,
  minimumMonthSampleTrips: BUSINESS_MEMORY_SAMPLE_THRESHOLDS.limited,
  strongPeakShare: 0.25,
  moderatePeakShare: 0.15,
} as const;

export type SeasonalityStrength = 'STRONG_PATTERN' | 'MODERATE_PATTERN' | 'WEAK_PATTERN' | 'INSUFFICIENT_DATA';
export type SeasonalityMetrics = {
  tripCount: number;
  revenue: number | null;
  cashReceived: number;
  expenses: number;
  profit: number | null;
  averageFreight: number | null;
  averageProfitPerTrip: number | null;
  averageMarginPct: number | null;
  averageCostPerKm: number | null;
  distanceSampleSize: number;
};
export type SeasonalityYearOverYear = {
  month: number;
  monthLabel: string;
  year: number;
  previousYear: number;
  tripCountChangePct: number | null;
  revenueChangePct: number | null;
  profitChangePct: number | null;
  marginChangePoints: number | null;
  explanation: string;
};
export type SeasonalityMonthPattern = SeasonalityMetrics & {
  month: number;
  monthLabel: string;
  yearsObserved: number;
};
export type SeasonalityEntity = {
  id: string;
  label: string;
  historicalTripCount: number;
  observedMonths: number;
  monthOfYearCount: number;
  yearsObserved: number;
  sufficientData: boolean;
  strength: SeasonalityStrength;
  explanation: string;
  strongestVolumeMonth: number | null;
  weakestVolumeMonth: number | null;
  strongestProfitMonth: number | null;
  weakestProfitMonth: number | null;
  monthlyPatterns: SeasonalityMonthPattern[];
  yearOverYear: SeasonalityYearOverYear[];
  yearOverYearExplanation: string;
  insights: string[];
};
export type SeasonalityMonthlyActivity = SeasonalityMetrics & { year: number; month: number; monthLabel: string };
export type SeasonalityRelatedPattern = { id: string; label: string; tripCount: number; revenue: number | null; profit: number | null; marginPct: number | null; averageFreight: number | null };
export type SeasonalityOverview = {
  filters: { year: number | null; startMonth: number | null; endMonth: number | null };
  sampleSize: number;
  sufficientData: boolean;
  explanation: string;
  monthlyActivity: SeasonalityMonthlyActivity[];
  commodities: SeasonalityEntity[];
  routeCommodities: Array<SeasonalityEntity & { routeId: string; routeLabel: string; commodityId: string; commodityName: string }>;
  customers: Array<SeasonalityEntity & { relatedCommodities: SeasonalityRelatedPattern[]; relatedRoutes: SeasonalityRelatedPattern[] }>;
  insights: string[];
};
export type SeasonalityRouteDetail = SeasonalityEntity & { routeId: string; routeLabel: string };
export type SeasonalityCommodityDetail = {
  commodity: SeasonalityEntity;
  routeCommodities: SeasonalityRouteDetail[];
  customers: Array<SeasonalityEntity & { relatedCommodities: SeasonalityRelatedPattern[]; relatedRoutes: SeasonalityRelatedPattern[] }>;
};
export type SeasonalityCustomerDetail = SeasonalityEntity & { relatedCommodities: SeasonalityRelatedPattern[]; relatedRoutes: SeasonalityRelatedPattern[] };
export type SeasonalityComparison = {
  entityType: 'commodity' | 'routeCommodity' | 'customer';
  entityId: string;
  metric: 'tripCount' | 'averageProfitPerTrip' | 'averageMarginPct';
  sufficientData: boolean;
  explanation: string;
  data: Array<{ month: number; monthLabel: string; entityValue: number | null; fleetValue: number | null; sampleSize: number }>;
};

export type CostIntelligenceFlagCode =
  | 'HIGH_COST_PER_KM'
  | 'LOW_PROFIT_MARGIN'
  | 'HIGH_EXPENSE_RATIO'
  | 'LOW_TRIP_PROFIT'
  | 'FUEL_COST_ANOMALY'
  | 'MAINTENANCE_COST_HIGH'
  | 'EXPENSE_CATEGORY_DISPROPORTIONATE'
  | 'ROUTE_TOLL_COST_HIGH'
  | 'CUSTOMER_LOW_MARGIN';

export type CostIntelligenceFlag = {
  code: CostIntelligenceFlagCode;
  severity: 'INFO' | 'WARNING' | 'ALERT';
  title: string;
  explanation: string;
  metric: string;
  currentValue: number;
  baselineValue: number | null;
  unit: 'INR' | 'INR_PER_KM' | 'PERCENT';
  sampleSize: number;
};

export type CostIntelligenceSummary = {
  period: FinanceReportPeriod;
  sampleSize: number;
  sufficientData: boolean;
  explanation: string;
  totalRevenue: number;
  cashReceived: number;
  totalExpenses: number;
  totalProfit: number | null;
  totalDistanceKm: number | null;
  costPerKm: number | null;
  averageProfitPerTrip: number | null;
  averageRevenuePerTrip: number | null;
  averageExpensePerTrip: number | null;
  expenseToRevenuePct: number | null;
  profitMarginPct: number | null;
  comparison: {
    sufficientData: boolean;
    explanation: string;
    revenueChangePct: number | null;
    expenseChangePct: number | null;
    profitChangePct: number | null;
    costPerKmChangePct: number | null;
    expenseCategories: Record<ExpenseType, { current: number; previous: number | null; changePct: number | null }>;
  };
};

export type CostIntelligenceCategory = {
  type: ExpenseType;
  label: string;
  totalAmount: number;
  sharePct: number | null;
  expenseCount: number;
  averageExpense: number | null;
  previousAmount: number | null;
  trendChangePct: number | null;
  sampleSufficient: boolean;
  explanation: string;
};

export type CostIntelligenceVehicle = {
  vehicleId: string;
  registrationNumber: string;
  tripCount: number;
  sufficientData: boolean;
  explanation: string;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  distanceKm: number | null;
  costPerKm: number | null;
  revenuePerKm: number | null;
  profitPerKm: number | null;
  averageProfitPerTrip: number | null;
  profitMarginPct: number | null;
  fuelCost: number;
  fuelCostPerKm: number | null;
  expenseBreakdown: Record<ExpenseType, number>;
  fleetCostPerKm: number | null;
  costPerKmDifferencePct: number | null;
  flags: CostIntelligenceFlag[];
};

export type CostIntelligenceCustomer = {
  customerId: string;
  customerName: string;
  tripCount: number;
  sufficientData: boolean;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  marginPct: number | null;
  averageProfitPerTrip: number | null;
  segment: 'HIGH_REVENUE_HIGH_PROFIT' | 'HIGH_REVENUE_LOW_MARGIN' | 'LOW_REVENUE_HIGH_MARGIN' | 'CONSISTENTLY_LOW_PROFIT' | null;
  explanation: string;
};

export type CostIntelligenceRoute = {
  routeId: string;
  routeLabel: string;
  tripCount: number;
  sufficientData: boolean;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  distanceKm: number | null;
  costPerKm: number | null;
  profitPerKm: number | null;
  averageMarginPct: number | null;
  averageTripCost: number | null;
  tollCost: number;
  flags: CostIntelligenceFlag[];
};

export type CostIntelligenceReport<T> = {
  period: FinanceReportPeriod | null;
  sampleSize: number;
  sufficientData: boolean;
  explanation: string;
  data: T[];
};

export type RouteIntelligenceFlagCode = 'HIGH_COST_ROUTE' | 'LOW_MARGIN_ROUTE' | 'HIGH_TOLL_BURDEN' | 'HIGH_FUEL_COST' | 'LOW_PROFIT_PER_KM' | 'INSUFFICIENT_ROUTE_DATA';
export type RouteIntelligenceFlag = {
  code: RouteIntelligenceFlagCode;
  severity: 'INFO' | 'WARNING';
  title: string;
  explanation: string;
  metric: string;
  value: number | null;
  baseline: number | null;
  sampleSize: number;
};
export type RouteIntelligenceOption = { id: string; label: string; tripCount: number };
export type RouteIntelligenceBreakdown = { type: ExpenseType; total: number; averagePerTrip: number | null; sharePct: number | null };
export type RouteIntelligenceSegment = {
  id: string;
  label: string;
  tripCount: number;
  revenue: number | null;
  expenses: number;
  profit: number | null;
  marginPct: number | null;
  averageFreight: number | null;
  costPerKm: number | null;
  profitPerKm: number | null;
  fuelCost: number;
  fuelCostPerKm: number | null;
  fuelLitres: number | null;
  kmPerLitre: number | null;
  sufficientData: boolean;
  explanation: string;
};
export type RouteIntelligenceReport = {
  route: { id: string; label: string; estimatedDistanceKm: number | null; tripCount: number };
  sampleSize: number;
  sufficientData: boolean;
  explanation: string;
  performance: {
    tripCount: number; revenue: number | null; cashReceived: number; expenses: number; profit: number | null;
    averageRevenuePerTrip: number | null; averageExpensePerTrip: number | null; averageProfitPerTrip: number | null;
    averageMarginPct: number | null; totalDistanceKm: number | null; averageDistancePerTrip: number | null;
    costPerKm: number | null; revenuePerKm: number | null; profitPerKm: number | null;
  };
  expenses: RouteIntelligenceBreakdown[];
  fuel: { sufficientData: boolean; explanation: string; totalCost: number | null; averageCostPerTrip: number | null; totalLitres: number | null; fuelCostPerKm: number | null; kmPerLitre: number | null; fleetFuelCostPerKm: number | null };
  toll: { totalCost: number; averagePerTrip: number | null; costPerKm: number | null; sharePct: number | null; otherRoutesAverageSharePct: number | null };
  vehicles: RouteIntelligenceSegment[];
  commodities: RouteIntelligenceSegment[];
  customers: RouteIntelligenceSegment[];
  flags: RouteIntelligenceFlag[];
  insights: string[];
};
export type RouteIntelligenceComparison = { metric: string; sampleSize: number; sufficientData: boolean; explanation: string; routes: Array<{ routeId: string; routeLabel: string; tripCount: number; value: number | null }> };

export type BusinessMemoryHistoryEntry = {
  id: string;
  label: string;
  tripCount: number;
  pricedTripCount: number;
  totalRevenue: number | null;
  totalCost: number;
  totalProfit: number | null;
  marginPct: number | null;
  averageRevenuePerTrip: number | null;
  averageCostPerKm: number | null;
  lastTripDate: string | null;
  confidence: BusinessMemoryConfidence;
  explanation: string;
};

export type BusinessMemoryTrip = {
  tripId: string;
  tripNumber: string;
  startDate: string;
  customerName: string | null;
  origin: string;
  destination: string;
  routeLabel: string;
  commodityName: string | null;
  vehicleRegistrationNumber: string;
  revenue: number | null;
  totalCost: number;
  profit: number | null;
  marginPct: number | null;
  distanceKm: number | null;
  costPerKm: number | null;
  fuelCost: number;
  cashReceived: number;
  outstanding: number | null;
  profitabilityBasis: 'ACTUAL' | 'ESTIMATED' | null;
};

export type BusinessMemoryFreightRate = {
  id: string;
  routeLabel: string;
  commodityName: string | null;
  vehicleType: VehicleType | null;
  rateBasis: RateBasis;
  sampleSize: number;
  minimumRate: number;
  averageRate: number;
  maximumRate: number;
  latestRate: number;
  latestEffectiveDate: string;
  confidence: BusinessMemoryConfidence;
  explanation: string;
};

export type BusinessMemoryOverview = {
  sampleSize: number;
  pricedTripCount: number;
  confidence: BusinessMemoryConfidence;
  explanation: string;
  customers: BusinessMemoryHistoryEntry[];
  routes: BusinessMemoryHistoryEntry[];
  commodities: BusinessMemoryHistoryEntry[];
  vehicles: BusinessMemoryHistoryEntry[];
  freightRates: BusinessMemoryFreightRate[];
  historicalTrips: BusinessMemoryTrip[];
};

export type BusinessMemorySimilarTrips = {
  referenceTripId: string;
  sampleSize: number;
  confidence: BusinessMemoryConfidence;
  explanation: string;
  data: Array<BusinessMemoryTrip & { similarityReasons: string[] }>;
};

export type CostInsightSeverity = 'INFO' | 'WARNING' | 'ALERT';

export type CostInsightType =
  | 'FUEL_EFFICIENCY'
  | 'MAINTENANCE_COST'
  | 'LOW_PROFIT_ROUTE'
  | 'HIGH_TOLL_RATIO'
  | 'HIGH_DRIVER_COST'
  | 'FUEL_PRICE_ANOMALY';

export type CostInsight = {
  type: CostInsightType;
  severity: CostInsightSeverity;
  entityType: 'VEHICLE' | 'ROUTE' | 'FLEET';
  entityId: string;
  entityLabel: string;
  metric: string;
  currentValue: number;
  baselineValue: number;
  unit: string;
  explanation: string;
  calculatedFrom: string;
};

// ─── API Response Shapes ─────────────────────────────────────────────────────

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = ApiSuccessResponse<T[]> & {
  meta: PaginationMeta;
};
