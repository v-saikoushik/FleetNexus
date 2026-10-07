import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApiSuccessResponse } from '@fleetnexus/shared';
import { apiClient } from '@/shared/lib/api-client';

type TripRow = {
  id: string;
  tripNumber: string;
  status: string;
  financialStatus: 'OPEN' | 'READY_FOR_REVIEW' | 'FINALIZED';
  originName: string;
  destinationName: string;
  startDate: string;
  actualFreight: number | null;
  actualDistanceKm: number | null;
};
type Category = { amount: number; recordCount: number; status: 'RECORDED' | 'MISSING' };
type Review = {
  tripId: string;
  status?: 'NOT_READY' | 'FINALIZED';
  financialStatus: TripRow['financialStatus'];
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  completeness: { freight: { status: string; amount: number | null }; distance: { status: string; kilometres: number | null }; payments: { status: string; recordCount: number }; expensesReviewed: boolean };
  financialSummary: {
    revenue: number | null;
    revenueBasis: string;
    paymentsReceived: number;
    outstanding: number | null;
    expenses: { fuel: Category; toll: Category; driver: Category; loading: Category; unloading: Category; maintenance: Category; other: Category; total: number };
    recordedProfit: number | null;
    recordedMarginPct: number | null;
    costPerKm: number | null;
    profitPerKm: number | null;
    estimatedProfit: number | null;
    distanceKm: number | null;
    distanceBasis: string;
  };
};
const money = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function TripFinancialsPage() {
  const client = useQueryClient();
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const trips = useQuery({ queryKey: ['completed-trips-financial-review'], queryFn: () => apiClient.get<ApiSuccessResponse<TripRow[]>>('/trips?status=COMPLETED').then(({ data }) => data.data) });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['completed-trips-financial-review'] }); void client.invalidateQueries({ queryKey: ['load-outcomes'] }); void client.invalidateQueries({ queryKey: ['load-outcomes-summary'] }); };
  const review = useMutation({ mutationFn: async (tripId: string) => (await apiClient.post<ApiSuccessResponse<Review>>(`/trips/${tripId}/financial-review`)).data.data, onSuccess: (result) => { setReviews((current) => ({ ...current, [result.tripId]: result })); refresh(); } });
  const finalize = useMutation({ mutationFn: async (tripId: string) => (await apiClient.post<ApiSuccessResponse<Review>>(`/trips/${tripId}/finalize-financials`)).data.data, onSuccess: (result) => { setReviews((current) => ({ ...current, [result.tripId]: result })); refresh(); } });
  const reopen = useMutation({ mutationFn: async (tripId: string) => (await apiClient.post<ApiSuccessResponse<{ tripId: string }>>(`/trips/${tripId}/reopen-financials`)).data.data, onSuccess: (result) => { setReviews((current) => { const next = { ...current }; delete next[result.tripId]; return next; }); refresh(); } });

  return <section className="mx-auto max-w-6xl space-y-5">
    <header><h1 className="text-2xl font-bold text-slate-900">Trip Financial Review</h1><p className="mt-1 text-sm text-slate-600">Review recorded amounts, resolve missing required trip data, then explicitly finalize financials. Missing expense categories are warnings; they are never silently treated as verified zero.</p></header>
    {trips.isLoading && <p className="text-sm text-slate-500">Loading completed trips…</p>}{trips.isError && <p role="alert" className="text-sm text-red-700">Trips could not be loaded.</p>}
    {trips.data?.map((trip) => {
      const result = reviews[trip.id];
      const financialStatus = result?.financialStatus ?? trip.financialStatus;
      const summary = result?.financialSummary;
      return <article key={trip.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{trip.tripNumber} · {trip.originName} → {trip.destinationName}</h2><p className="text-sm text-slate-500">Trip status: {trip.status} · Financial status: <strong>{financialStatus.replaceAll('_', ' ')}</strong></p></div><div className="flex gap-2"><button onClick={() => review.mutate(trip.id)} disabled={review.isPending || financialStatus === 'FINALIZED'} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Review financials</button>{financialStatus === 'READY_FOR_REVIEW' && <button onClick={() => finalize.mutate(trip.id)} disabled={finalize.isPending} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Finalize financials</button>}{financialStatus === 'FINALIZED' && <button onClick={() => reopen.mutate(trip.id)} disabled={reopen.isPending} className="rounded-md border border-amber-300 px-3 py-2 text-sm text-amber-800 disabled:opacity-50">Reopen financials</button>}</div></div>
        {result?.blockingIssues.length ? <div className="rounded-lg bg-red-50 p-3"><p className="font-medium text-red-800">Financials are not ready</p><ul className="mt-1 list-disc pl-5 text-sm text-red-700">{result.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : result?.warnings.length ? <div className="rounded-lg bg-amber-50 p-3"><p className="font-medium text-amber-800">Review warnings</p><ul className="mt-1 list-disc pl-5 text-sm text-amber-700">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        {summary && <><div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Revenue <strong className="block">{money(summary.revenue)} · {summary.revenueBasis}</strong></p><p>Payments received <strong className="block">{money(summary.paymentsReceived)}</strong></p><p>Outstanding <strong className="block">{money(summary.outstanding)}</strong></p><p>Distance <strong className="block">{summary.distanceKm == null ? '—' : `${summary.distanceKm} km · ${summary.distanceBasis}`}</strong></p><p>Recorded expenses <strong className="block">{money(summary.expenses.total)}</strong></p><p>Recorded profit <strong className="block">{money(summary.recordedProfit)}</strong></p><p>Recorded margin <strong className="block">{summary.recordedMarginPct == null ? '—' : `${summary.recordedMarginPct.toFixed(1)}%`}</strong></p><p>Cost/km · profit/km <strong className="block">{money(summary.costPerKm)} · {money(summary.profitPerKm)}</strong></p></div><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{(['fuel', 'toll', 'driver', 'loading', 'unloading', 'maintenance', 'other'] as const).map((key) => { const value = summary.expenses[key]; return <p key={key} className="rounded-md bg-slate-50 p-3 capitalize">{key}: {money(value.amount)} · {value.status === 'RECORDED' ? `${value.recordCount} record(s)` : 'MISSING'}</p>; })}</div><div className="text-sm text-slate-600">Revenue available: {result.completeness.freight.status} · Distance available: {result.completeness.distance.status} · Expense review: {result.completeness.expensesReviewed ? 'complete' : 'pending'} · Payment status: {result.completeness.payments.status}</div></>}
        {financialStatus === 'FINALIZED' && <p className="text-sm font-medium text-emerald-700">Financials finalized. Expense, payment, and Trip edits require an explicit reopen.</p>}
      </article>;
    })}
    {trips.data?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No completed trips are available for financial review.</p>}
  </section>;
}
