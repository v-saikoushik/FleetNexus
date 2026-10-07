import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  ApiSuccessResponse, FinanceCashFlowReport, FinanceDashboardSummary, FinanceExpenseEntry,
  FinanceInsight, FinanceOutstandingItem, FinancePeriodType, FinanceTripProfitability,
  FinanceVehicleProfitability,
} from '@fleetnexus/shared';
import { FINANCE_PERIODS } from '@fleetnexus/shared';
import { apiClient } from '@/shared/lib/api-client';

const money = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null) => value == null ? '—' : `${value.toFixed(1)}%`;
const endpoint = <T,>(path: string, period: FinancePeriodType) => apiClient.get<ApiSuccessResponse<T>>(`/finance/${path}`, { params: { period } }).then(({ data }) => data.data);

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold">{title}</h2>{children}</section>;
}
function Empty() { return <p className="py-5 text-center text-sm text-slate-500">No financial data yet.</p>; }
function Bar({ label, value, max, color = 'bg-blue-600' }: { label: string; value: number; max: number; color?: string }) {
  return <div className="space-y-1"><div className="flex justify-between gap-3 text-sm"><span>{label}</span><span>{money(value)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${max > 0 ? Math.max(1, value / max * 100) : 0}%` }} /></div></div>;
}

export function FinancePage() {
  const [period, setPeriod] = useState<FinancePeriodType>('MONTHLY');
  const options = { queryKey: ['finance', period], staleTime: 30_000 };
  const summary = useQuery({ ...options, queryKey: [...options.queryKey, 'summary'], queryFn: () => endpoint<FinanceDashboardSummary>('summary', period) });
  const expenses = useQuery({ ...options, queryKey: [...options.queryKey, 'expenses'], queryFn: () => endpoint<{ recent: FinanceExpenseEntry[]; highValue: FinanceExpenseEntry[] }>('expenses', period) });
  const vehicles = useQuery({ ...options, queryKey: [...options.queryKey, 'vehicles'], queryFn: () => endpoint<{ data: FinanceVehicleProfitability[] }>('vehicles', period) });
  const trips = useQuery({ ...options, queryKey: [...options.queryKey, 'trips'], queryFn: () => endpoint<{ data: FinanceTripProfitability[] }>('trips', period) });
  const cashFlow = useQuery({ ...options, queryKey: [...options.queryKey, 'cash-flow'], queryFn: () => endpoint<FinanceCashFlowReport>('cash-flow', period) });
  const outstanding = useQuery({ ...options, queryKey: [...options.queryKey, 'outstanding'], queryFn: () => endpoint<{ data: FinanceOutstandingItem[] }>('outstanding', period) });
  const insights = useQuery({ ...options, queryKey: [...options.queryKey, 'insights'], queryFn: () => endpoint<{ data: FinanceInsight[] }>('insights', period) });
  const error = [summary, expenses, vehicles, trips, cashFlow, outstanding, insights].find((query) => query.isError);
  const busy = [summary, expenses, vehicles, trips, cashFlow, outstanding, insights].some((query) => query.isLoading);
  const data = summary.data;
  const noData = data && !data.revenue.tripCount && !data.expenses.count && !data.cashReceived;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Finance</h1><p className="mt-2 text-sm text-slate-600">Period reporting for revenue, costs, collections, and fleet profitability.</p></div><label className="text-sm font-medium">Reporting period <select className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2" value={period} onChange={(event) => setPeriod(event.target.value as FinancePeriodType)}>{FINANCE_PERIODS.map((item) => <option key={item} value={item}>{item[0] + item.slice(1).toLowerCase()}</option>)}</select></label></header>
    {busy && <p className="text-sm text-slate-500">Loading finance reports…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Finance reports could not be loaded. Please try again.</p>}
    {noData && <div className="rounded-xl border border-slate-200 bg-white p-5"><Empty /></div>}
    {data && !noData && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
        ['Revenue', money(data.revenue.total)], ['Cash received', money(data.cashReceived)], ['Outstanding', money(data.outstanding)], ['Expenses', money(data.expenses.total)], ['Profit', money(data.profit)],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-5 lg:grid-cols-2"><Panel title="Revenue and expenses"><div className="space-y-4"><Bar label="Revenue" value={data.revenueVsExpenses.revenue} max={Math.max(data.revenueVsExpenses.revenue, data.revenueVsExpenses.expenses)} /><Bar label="Expenses" value={data.revenueVsExpenses.expenses} max={Math.max(data.revenueVsExpenses.revenue, data.revenueVsExpenses.expenses)} color="bg-amber-500" /><p className="text-xs text-slate-500">{data.revenue.tripCount} completed trips with recorded revenue · Margin {pct(data.profitMarginPct)}</p></div></Panel>
        <Panel title="Trip financial finalization"><p className="mb-3 text-xs text-slate-500">Existing period totals above are unchanged. This separate view distinguishes finalized trips from recorded, unfinalized values.</p><div className="grid gap-4 sm:grid-cols-2">{(['finalized', 'unfinalized'] as const).map((status) => { const group = data.financialFinalization[status]; return <div key={status} className="rounded-lg bg-slate-50 p-3"><h3 className="font-medium capitalize">{status} · {group.tripCount} trips</h3><p className="mt-2 text-sm">Revenue {money(group.revenue)}</p><p className="text-sm">Recorded expenses {money(group.recordedExpenses)}</p><p className="text-sm">Profit {money(group.profit)}</p></div>; })}</div></Panel>
      </div>
      <Panel title="Expense categories"><div className="space-y-3">{Object.entries(data.expenses.byCategory).filter(([, amount]) => amount > 0).length ? Object.entries(data.expenses.byCategory).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <Bar key={category} label={category.replaceAll('_', ' ')} value={amount} max={data.expenses.total} color="bg-violet-600" />) : <Empty />}</div></Panel>
      <div className="grid gap-5 lg:grid-cols-2"><Panel title="Cash flow"><p className="mb-3 text-sm text-slate-500">Net {money(cashFlow.data?.netCashFlow)} · {cashFlow.data?.basis}</p>{cashFlow.data?.buckets.some((bucket) => bucket.moneyIn || bucket.moneyOut) ? <div className="space-y-3">{cashFlow.data.buckets.filter((bucket) => bucket.moneyIn || bucket.moneyOut).map((bucket) => <div key={bucket.startDate} className="grid grid-cols-[4rem_1fr] gap-3 text-sm"><span>{bucket.label}</span><div className="space-y-1"><Bar label="In" value={bucket.moneyIn} max={Math.max(bucket.moneyIn, bucket.moneyOut)} /><Bar label="Out" value={bucket.moneyOut} max={Math.max(bucket.moneyIn, bucket.moneyOut)} color="bg-amber-500" /></div></div>)}</div> : <Empty />}</Panel>
      <Panel title="Finance insights">{insights.data?.data.length ? <ul className="space-y-3">{insights.data.data.map((item) => <li key={item.type} className="rounded-lg bg-slate-50 p-3 text-sm">{item.message} <span className="font-medium">{money(item.currentValue)}</span>{item.baselineValue != null && <span className="text-slate-500"> (previous: {money(item.baselineValue)})</span>}</li>)}</ul> : <Empty />}</Panel></div>
      <Panel title="Vehicle profitability">{vehicles.data?.data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-slate-500"><tr>{['Vehicle', 'Trips', 'Revenue', 'Expenses', 'Profit', 'Cost / km'].map((head) => <th key={head} className="border-b px-3 py-2 font-medium">{head}</th>)}</tr></thead><tbody>{vehicles.data.data.map((vehicle) => <tr key={vehicle.vehicleId}><td className="border-b px-3 py-3 font-medium">{vehicle.registrationNumber}</td><td className="border-b px-3 py-3">{vehicle.tripCount}</td><td className="border-b px-3 py-3">{money(vehicle.revenue)}</td><td className="border-b px-3 py-3">{money(vehicle.expenses)}</td><td className="border-b px-3 py-3">{money(vehicle.profit)}</td><td className="border-b px-3 py-3">{money(vehicle.costPerKm)}</td></tr>)}</tbody></table></div> : <Empty />}</Panel>
      <div className="grid gap-5 lg:grid-cols-2"><Panel title="Outstanding by trip">{outstanding.data?.data.length ? <div className="space-y-3">{outstanding.data.data.map((item) => <div key={item.tripId} className="flex justify-between gap-4 border-b pb-2 text-sm"><span>{item.tripNumber}<span className="block text-xs text-slate-500">{item.customerName ?? 'Customer not recorded'}</span></span><span className="text-right">{money(item.outstanding)}<span className="block text-xs text-slate-500">of {money(item.revenue)}</span></span></div>)}</div> : <Empty />}</Panel>
      <Panel title="Recent expenses">{expenses.data?.recent.length ? <div className="space-y-3">{expenses.data.recent.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b pb-2 text-sm"><span>{item.description || item.type.replaceAll('_', ' ')}<span className="block text-xs text-slate-500">{new Date(item.date).toLocaleDateString()} · {item.vehicleRegistrationNumber ?? item.tripNumber ?? 'Unassigned'}</span></span><span>{money(item.amount)}</span></div>)}</div> : <Empty />}</Panel></div>
      <Panel title="Trip profitability">{trips.data?.data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-slate-500"><tr>{['Trip', 'Date', 'Vehicle', 'Revenue', 'Costs', 'Profit', 'Distance'].map((head) => <th key={head} className="border-b px-3 py-2 font-medium">{head}</th>)}</tr></thead><tbody>{trips.data.data.slice(0, 10).map((trip) => <tr key={trip.tripId}><td className="border-b px-3 py-3">{trip.tripNumber}</td><td className="border-b px-3 py-3">{new Date(trip.startDate).toLocaleDateString()}</td><td className="border-b px-3 py-3">{trip.vehicleRegistrationNumber ?? '—'}</td><td className="border-b px-3 py-3">{money(trip.revenue)}</td><td className="border-b px-3 py-3">{money(trip.costs)}</td><td className="border-b px-3 py-3">{money(trip.profit)}</td><td className="border-b px-3 py-3">{trip.distanceKm == null ? '—' : `${trip.distanceKm} km`}</td></tr>)}</tbody></table></div> : <Empty />}</Panel>
      {expenses.data?.highValue.length ? <Panel title="Highest value expenses"><div className="grid gap-2 sm:grid-cols-2">{expenses.data.highValue.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{item.description || item.type.replaceAll('_', ' ')}</span><span className="font-medium">{money(item.amount)}</span></div>)}</div></Panel> : null}
    </>}
  </div>;
}
