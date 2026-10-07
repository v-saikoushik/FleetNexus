import { Outlet, Link } from 'react-router-dom';
import { APP_NAME } from '@fleetnexus/shared';

/**
 * DashboardLayout — used for authenticated, post-login pages.
 * Will include: sidebar navigation, user menu, notifications, breadcrumbs.
 *
 * Placeholder: full implementation in a later sprint once auth is in place.
 */
export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar — placeholder */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-6">
          <span className="text-sm font-semibold tracking-tight text-slate-800">{APP_NAME}</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <Link to="/dashboard" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Dashboard
          </Link>
          <Link to="/intelligence" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Business Intelligence
          </Link>
          <Link to="/finance" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Finance
          </Link>
          <Link to="/trips/financials" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Trip Financial Review
          </Link>
          <Link to="/intelligence/costs" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cost Intelligence
          </Link>
          <Link to="/intelligence/routes" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Route Intelligence
          </Link>
          <Link to="/intelligence/seasonality" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Seasonality &amp; Demand
          </Link>
          <Link to="/intelligence/forecasting" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Demand Forecasting
          </Link>
          <Link to="/intelligence/load-profitability" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Load Profitability
          </Link>
          <Link to="/intelligence/load-decision" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Decision Support
          </Link>
          <Link to="/intelligence/outcomes" className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
            Load Outcomes
          </Link>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          {/* Top bar: breadcrumbs, user avatar, notifications */}
        </header>
        <main className="flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
