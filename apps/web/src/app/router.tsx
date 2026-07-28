import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/public-layout';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * AppRouter — defines all application routes grouped by layout.
 *
 * Route groups:
 *   Public routes  — use PublicLayout (landing, auth pages, etc.)
 *   Private routes — will use DashboardLayout once auth is in place
 *
 * Pattern: add new routes to the correct layout group, not as flat siblings.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ─────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
        </Route>

        {/* ── Authenticated routes (placeholder) ────────────── */}
        {/* Uncomment when DashboardLayout + auth guards are ready:
        <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        */}

        {/* ── Fallback ───────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
