import { useAuth } from '@/features/auth';
import { Button } from '@fleetnexus/ui';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back, {user?.firstName}!</p>
        </div>
        <Button
          onClick={logout}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account Email</p>
          <p className="text-lg font-medium text-slate-900">{user?.email}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Role</p>
          <p className="text-lg font-medium text-slate-900">{user?.role}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Organization ID</p>
          <p className="text-lg font-medium text-slate-900">{user?.organizationId ?? 'Unassigned'}</p>
        </div>
      </div>
    </div>
  );
}
