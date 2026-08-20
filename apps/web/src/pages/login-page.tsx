import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@fleetnexus/ui';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to FleetNexus</h1>
        <p className="text-sm text-slate-500">
          Enter your email or phone and password to access your portal
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Email or phone</label>
          <input
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
            placeholder="user@organization.com or +91..."
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline">
          Register
        </Link>
      </p>
    </div>
  );
}
