import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout, PublicLayout } from '@/layouts';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { IntelligencePage } from '@/pages/intelligence-page';
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
          </Route>
        </Route>

        {/* ── Fallback ───────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
