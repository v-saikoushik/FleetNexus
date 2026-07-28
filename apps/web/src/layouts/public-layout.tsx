import { Outlet } from 'react-router-dom';
import { APP_NAME } from '@fleetnexus/shared';

/**
 * PublicLayout — used for marketing pages, auth pages, etc.
 * No sidebar, no app navigation.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
