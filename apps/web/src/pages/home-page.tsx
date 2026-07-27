import { APP_NAME } from '@fleetnexus/shared';
import { Button } from '@fleetnexus/ui';

export function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="max-w-2xl text-slate-600">
        AI-powered Transport ERP foundation is ready. Business modules will be added in later
        phases.
      </p>
      <Button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Get started
      </Button>
    </section>
  );
}
