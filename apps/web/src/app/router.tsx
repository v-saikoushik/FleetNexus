import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout, PublicLayout } from '@/layouts';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { IntelligencePage } from '@/pages/intelligence-page';
import { FinancePage } from '@/pages/finance-page';
import { CostIntelligencePage } from '@/pages/cost-intelligence-page';
import { RouteIntelligencePage } from '@/pages/route-intelligence-page';
import { SeasonalityPage } from '@/pages/seasonality-page';
import { ForecastingPage } from '@/pages/forecasting-page';
import { LoadProfitabilityPage } from '@/pages/load-profitability-page';
import { OutcomeTrackingPage } from '@/pages/outcome-tracking-page';
import { TripFinancialsPage } from '@/pages/trip-financials-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ProtectedRoute } from '@/features/auth';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ─────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* ── Authenticated routes ──────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/intelligence/costs" element={<CostIntelligencePage />} />
            <Route path="/intelligence/routes" element={<RouteIntelligencePage />} />
            <Route path="/intelligence/seasonality" element={<SeasonalityPage />} />
            <Route path="/intelligence/forecasting" element={<ForecastingPage />} />
            <Route path="/intelligence/load-profitability" element={<LoadProfitabilityPage />} />
            <Route path="/intelligence/load-decision" element={<LoadProfitabilityPage />} />
            <Route path="/intelligence/outcomes" element={<OutcomeTrackingPage />} />
            <Route path="/trips/financials" element={<TripFinancialsPage />} />
          </Route>
        </Route>

        {/* ── Fallback ───────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
