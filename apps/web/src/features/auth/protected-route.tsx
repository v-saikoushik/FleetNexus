import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-500">Loading authentication state...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
