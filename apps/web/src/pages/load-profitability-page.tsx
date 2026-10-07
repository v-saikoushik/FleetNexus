import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiSuccessResponse, SeasonalityEntity } from '@fleetnexus/shared';
import { apiClient } from '@/shared/lib/api-client';

type Option = { id: string; name?: string; label?: string; registrationNumber?: string };
type Options<T> = { data: T[] };
type ComponentEstimate = { amount: number | null; sampleSize: number; basis: string; method?: string };
type Analysis = {
  analysisStatus: 'SUPPORTED' | 'LIMITED' | 'INSUFFICIENT_DATA';
  input: { route: { label: string }; commodity: { name: string }; customer: { name: string } | null; vehicle: { registrationNumber: string } | null; offeredFreight: number | null; distanceKm: number | null; loadWeightTons: number | null };
  historical: { comparableTripCount: number; averageFreight: number | null; averageTotalCost: number | null; averageProfit: number | null; medianProfit: number | null; averageMarginPct: number | null; recentTrips: Array<{ tripId: string; tripNumber: string; date: string; revenue: number | null; totalCost: number; profit: number | null; marginPct: number | null; similarityReasons: string[] }> };
  estimate: { revenue: { amount: number | null; basis: string; sampleSize: number | null }; costs: { components: Record<string, ComponentEstimate>; total: number | null; sampleSize: number; basis: string }; profit: number | null; marginPct: number | null; costPerKm: number | null; profitPerKm: number | null };
  benchmark: { averageHistoricalProfit: number | null; medianHistoricalProfit: number | null; averageHistoricalMarginPct: number | null; averageHistoricalCost: number | null; proposedProfit: number | null; proposedMarginPct: number | null; profitDifferenceFromAverage: number | null; explanation: string };
  sample: { count: number; status: string; explanation: string };
  dataQuality: Array<{ code: string; severity: string; explanation: string }>;
  explanation: string;
};
type Decision = {
  decision: 'ACCEPT' | 'REVIEW' | 'AVOID'; recommendation: string; evidenceLevel: string; expectedProfit: number | null; expectedMarginPct: number | null; comparableTripCount: number;
  historicalBenchmarks: { averageProfit: number | null; averageMarginPct: number | null; proposedMarginDifferencePoints: number | null; explanation: string };
  dataQuality: Array<{ code: string; severity: string; explanation: string }>;
  rules: Array<{ code: string; result: string; severity: string; metric: string | number | null; explanation: string }>;
  explanation: string; limitations: string[]; economics: Analysis;
};
const panel = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const money = (n: number | null | undefined) => n == null ? 'Unavailable' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const percent = (n: number | null | undefined) => n == null ? 'Unavailable' : `${n.toFixed(1)}%`;

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

export function LoadProfitabilityPage() {
  const location = useLocation();
  const decisionMode = location.pathname.endsWith('/load-decision');
  const [routeId, setRouteId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [freight, setFreight] = useState('');
  const [distance, setDistance] = useState('');
  const [weight, setWeight] = useState('');
  const [pickup, setPickup] = useState(new Date().toISOString().slice(0, 10));
  const [delivery, setDelivery] = useState('');
  const customers = useQuery({ queryKey: ['load-economics', 'customers'], queryFn: () => apiClient.get<ApiSuccessResponse<Option[]>>('/customers').then(({ data }) => data.data) });
  const vehicles = useQuery({ queryKey: ['load-economics', 'vehicles'], queryFn: () => apiClient.get<ApiSuccessResponse<Option[]>>('/vehicles').then(({ data }) => data.data) });
  const routes = useQuery({ queryKey: ['load-economics', 'routes'], queryFn: () => apiClient.get<ApiSuccessResponse<{ data: Option[] }>>('/intelligence/seasonality/routes').then(({ data }) => data.data.data) });
  const commodities = useQuery({ queryKey: ['load-economics', 'commodities'], queryFn: () => apiClient.get<ApiSuccessResponse<Options<SeasonalityEntity>>>('/intelligence/seasonality/commodities').then(({ data }) => data.data.data) });
  const mutation = useMutation({ mutationFn: (body: Record<string, unknown>) => apiClient.post<ApiSuccessResponse<Analysis>>('/intelligence/load-profitability/analyze', body).then(({ data }) => data.data) });
  const decisionMutation = useMutation({ mutationFn: (body: Record<string, unknown>) => apiClient.post<ApiSuccessResponse<Decision>>('/intelligence/load-decision/analyze', body).then(({ data }) => data.data) });

  const commodity = commodityId || commodities.data?.[0]?.id || '';
  const route = routeId || routes.data?.[0]?.id || '';
  const requestBody = () => ({ routeId: route, commodityId: commodity, ...(customerId ? { customerId } : {}), ...(vehicleId ? { vehicleId } : {}), ...(freight ? { offeredFreight: Number(freight) } : {}), ...(distance ? { expectedDistanceKm: Number(distance) } : {}), ...(weight ? { loadWeightTons: Number(weight) } : {}), proposedPickupDate: pickup, ...(delivery ? { proposedDeliveryDate: delivery } : {}) });
  const onSubmit = (event: FormEvent) => { event.preventDefault(); mutation.mutate(requestBody()); };
  const onDecision = () => decisionMutation.mutate(requestBody());
  const result = mutation.data ?? decisionMutation.data?.economics;
  const decision = decisionMutation.data;

  return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{decisionMode ? 'Decision support' : 'Load economics'}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{decisionMode ? 'Load Decision Support' : 'Load Profitability Analysis'}</h1><p className="mt-2 text-sm text-slate-600">Analyze the proposed load against your own completed-trip history. FleetNexus provides a recommendation for owner review; it does not make or guarantee the final decision.</p></header>
    <form onSubmit={onSubmit} className={`${panel} space-y-4`}>
      <h2 className="font-semibold">Proposed load</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Route<select required value={route} onChange={(e) => setRouteId(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2"><option value="">Select route</option>{routes.data?.map((item) => <option key={item.id} value={item.id}>{item.label ?? item.name}</option>)}</select></label>
        <label className="text-sm">Commodity<select required value={commodity} onChange={(e) => setCommodityId(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2"><option value="">Select commodity</option>{commodities.data?.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="text-sm">Customer (optional)<select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2"><option value="">No customer selected</option>{customers.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm">Vehicle (optional)<select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2"><option value="">No vehicle selected</option>{vehicles.data?.map((item) => <option key={item.id} value={item.id}>{item.registrationNumber}</option>)}</select></label>
        <label className="text-sm">Offered freight (₹)<input type="number" min="0.01" step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="Use historical estimate" className="mt-1 block w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Expected distance (km)<input type="number" min="0.01" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Use saved route estimate" className="mt-1 block w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Load weight (tons)<input type="number" min="0.01" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Proposed pickup date<input required type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Proposed delivery date (optional)<input type="date" min={pickup} value={delivery} onChange={(e) => setDelivery(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" /></label>
      </div>
      <button type="submit" disabled={mutation.isPending || !route || !commodity} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Analyzing…' : 'Analyze Load'}</button>
      <button type="button" onClick={onDecision} disabled={decisionMutation.isPending || !route || !commodity} className="ml-2 rounded-md border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{decisionMutation.isPending ? 'Evaluating…' : 'Analyze & Get Decision'}</button>
      {mutation.isError && <p role="alert" className="text-sm text-red-700">Load analysis failed. Check the selected entities and input values.</p>}
      {decisionMutation.isError && <p role="alert" className="text-sm text-red-700">Decision analysis failed. Check the selected entities and input values.</p>}
    </form>
    {decision && <section className={`${panel} border-l-4 ${decision.decision === 'ACCEPT' ? 'border-l-emerald-500' : decision.decision === 'AVOID' ? 'border-l-red-500' : 'border-l-amber-500'}`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">FleetNexus recommends {decision.decision}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">{decision.evidenceLevel.replaceAll('_', ' ')}</span></div><p className="mt-3 text-sm text-slate-700">{decision.explanation}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Expected profit" value={money(decision.expectedProfit)} /><Metric label="Expected margin" value={percent(decision.expectedMarginPct)} /><Metric label="Comparable trips" value={String(decision.comparableTripCount)} /></div><p className="mt-3 text-sm text-slate-600">{decision.historicalBenchmarks.explanation}</p><h3 className="mt-5 font-semibold">Decision rules</h3><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr>{['Rule', 'Result', 'Metric', 'Explanation'].map((name) => <th key={name} className="border-b p-2">{name}</th>)}</tr></thead><tbody>{decision.rules.map((rule) => <tr key={rule.code}><td className="border-b p-2 font-medium">{rule.code.replaceAll('_', ' ')}</td><td className="border-b p-2">{rule.result}</td><td className="border-b p-2">{rule.metric ?? '—'}</td><td className="border-b p-2">{rule.explanation}</td></tr>)}</tbody></table></div><h3 className="mt-5 font-semibold">Data quality and limitations</h3>{decision.dataQuality.length ? <ul className="mt-2 space-y-2 text-sm">{decision.dataQuality.map((warning) => <li key={warning.code} className="rounded bg-amber-50 p-3"><strong>{warning.severity} · {warning.code.replaceAll('_', ' ')}</strong><p>{warning.explanation}</p></li>)}</ul> : <p className="mt-2 text-sm text-emerald-700">No data-quality warnings.</p>}<ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{decision.limitations.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-4 text-xs text-slate-500">The owner remains responsible for the final decision.</p></section>}
    {result && <>
      <section className={panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Load economics · {result.input.commodity.name}</h2><p className="mt-1 text-sm text-slate-600">{result.input.route.label}{result.input.customer ? ` · ${result.input.customer.name}` : ''}{result.input.vehicle ? ` · ${result.input.vehicle.registrationNumber}` : ''}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold">{result.analysisStatus}</span></div><p className="mt-3 text-sm text-slate-600">{result.explanation}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={result.estimate.revenue.basis === 'PROVIDED' ? 'Provided freight' : 'Historical estimated freight'} value={money(result.estimate.revenue.amount)} /><Metric label="Expected cost" value={money(result.estimate.costs.total)} /><Metric label="Expected profit" value={money(result.estimate.profit)} /><Metric label="Expected margin" value={percent(result.estimate.marginPct)} /><Metric label="Expected cost / km" value={money(result.estimate.costPerKm)} /><Metric label="Expected profit / km" value={money(result.estimate.profitPerKm)} /><Metric label="Distance basis" value={result.input.distanceKm == null ? 'Unavailable' : `${result.input.distanceKm} km`} /><Metric label="Sample status" value={`${result.sample.count} comparable trips · ${result.sample.status}`} /></div><p className="mt-3 text-xs text-slate-500">Revenue basis: {result.estimate.revenue.basis}. Cost basis: {result.estimate.costs.basis}</p></section>
      <section className={panel}><h2 className="font-semibold">Expected cost breakdown</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(result.estimate.costs.components).map(([key, item]) => <div key={key} className="rounded-lg border p-3"><p className="font-medium capitalize">{key.replaceAll(/([A-Z])/g, ' $1')}</p><p className="mt-1">{money(item.amount)}</p><p className="mt-1 text-xs text-slate-500">{item.sampleSize} records · {item.basis}</p></div>)}</div>{result.estimate.costs.components.fuel.method?.startsWith('OBSERVED') && <p className="mt-3 text-sm text-slate-600">Fuel estimate uses measured fuel litres, distance, and purchase amounts for matching selected-vehicle trips. Owner target km/L is not used as actual efficiency.</p>}</section>
      <section className={panel}><h2 className="font-semibold">Historical benchmark</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Comparable trips" value={String(result.historical.comparableTripCount)} /><Metric label="Average historical profit" value={money(result.benchmark.averageHistoricalProfit)} /><Metric label="Median historical profit" value={money(result.benchmark.medianHistoricalProfit)} /><Metric label="Average historical margin" value={percent(result.benchmark.averageHistoricalMarginPct)} /></div><p className="mt-3 text-sm text-slate-600">{result.benchmark.explanation}</p></section>
      <section className={panel}><h2 className="font-semibold">Comparable completed trips</h2><p className="mt-1 text-sm text-slate-600">Matches require the same saved route and commodity. Secondary matching reasons are shown per trip.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr>{['Trip', 'Date', 'Revenue', 'Recorded cost', 'Profit', 'Margin', 'Why comparable'].map((label) => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead><tbody>{result.historical.recentTrips.map((trip) => <tr key={trip.tripId}><td className="border-b p-2">{trip.tripNumber}</td><td className="border-b p-2">{new Date(trip.date).toLocaleDateString()}</td><td className="border-b p-2">{money(trip.revenue)}</td><td className="border-b p-2">{money(trip.totalCost)}</td><td className="border-b p-2">{money(trip.profit)}</td><td className="border-b p-2">{percent(trip.marginPct)}</td><td className="border-b p-2">{trip.similarityReasons.join(', ')}</td></tr>)}</tbody></table>{result.historical.recentTrips.length === 0 && <p className="py-4 text-sm text-slate-500">No comparable completed trips.</p>}</div></section>
      <section className={panel}><h2 className="font-semibold">Data quality</h2><p className="mt-1 text-sm text-slate-600">{result.sample.explanation}</p>{result.dataQuality.length ? <ul className="mt-3 space-y-2">{result.dataQuality.map((item) => <li key={item.code} className="rounded-lg bg-amber-50 p-3 text-sm"><strong>{item.code.replaceAll('_', ' ')} · {item.severity}</strong><p className="mt-1">{item.explanation}</p></li>)}</ul> : <p className="mt-3 text-sm text-emerald-700">No data-quality flags.</p>}</section>
    </>}
  </div>;
}
