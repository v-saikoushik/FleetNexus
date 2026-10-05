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
