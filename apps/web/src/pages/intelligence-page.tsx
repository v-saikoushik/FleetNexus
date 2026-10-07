import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  ApiSuccessResponse,
  BusinessMemoryEntityHistory,
  BusinessMemoryFreightHistory,
  BusinessMemoryOverview,
  BusinessMemorySimilarTrips,
  BusinessMemoryTrip,
} from '@fleetnexus/shared';
import { apiClient } from '@/shared/lib/api-client';

type HistoryKind = 'customers' | 'routes' | 'commodities' | 'vehicles';
const HISTORY_KINDS: Array<{ key: HistoryKind | 'freight' | 'similar'; label: string }> = [
  { key: 'customers', label: 'Customers' }, { key: 'routes', label: 'Routes' },
  { key: 'commodities', label: 'Commodities' }, { key: 'vehicles', label: 'Vehicles' },
  { key: 'freight', label: 'Freight rates' }, { key: 'similar', label: 'Similar trips' },
];
const money = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const confidence = (value: string) => value === 'SUPPORTED' ? 'Larger sample' : value === 'LIMITED' ? 'Limited sample' : 'Insufficient historical data';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function TripList({ trips, reasons }: { trips: Array<BusinessMemoryTrip & { similarityReasons?: string[] }>; reasons?: boolean }) {
  if (!trips.length) return <p className="text-sm text-slate-500">No historical trips available.</p>;
  return <div className="space-y-3">{trips.slice(0, 10).map((trip) => <article key={trip.tripId} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{trip.tripNumber} · {trip.routeLabel}</strong><span className="text-sm text-slate-500">{new Date(trip.startDate).toLocaleDateString()}</span></div><p className="mt-1 text-sm text-slate-600">{trip.customerName ?? 'Customer unavailable'} · {trip.commodityName ?? 'Commodity unavailable'} · {trip.vehicleRegistrationNumber}</p><p className="mt-1 text-sm">Freight {money(trip.revenue)} · Costs {money(trip.totalCost)} · Profit {money(trip.profit)} · Margin {trip.marginPct == null ? '—' : `${trip.marginPct.toFixed(1)}%`}</p>{reasons && <p className="mt-1 text-xs text-slate-500">Matched on: {trip.similarityReasons?.join(', ') || '—'}</p>}</article>)}</div>;
}

export function IntelligencePage() {
  const [kind, setKind] = useState<HistoryKind | 'freight' | 'similar'>('customers');
  const [entityId, setEntityId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [tripId, setTripId] = useState('');

  const overview = useQuery({
    queryKey: ['business-memory', 'overview'],
    queryFn: () => apiClient.get<ApiSuccessResponse<BusinessMemoryOverview>>('/intelligence/memory/overview').then(({ data }) => data.data),
  });
  const rows = kind !== 'freight' && kind !== 'similar' ? overview.data?.[kind] ?? [] : [];
  const selectedId = entityId || rows[0]?.id || '';
  const history = useQuery({
    queryKey: ['business-memory', 'history', kind, selectedId],
    enabled: Boolean(selectedId) && kind !== 'freight' && kind !== 'similar',
    queryFn: () => apiClient.get<ApiSuccessResponse<BusinessMemoryEntityHistory>>(`/intelligence/${kind}/${selectedId}/history`).then(({ data }) => data.data),
  });
  const savedRoutes = (overview.data?.routes ?? []).filter((item) => uuidPattern.test(item.id));
  const commodities = overview.data?.commodities ?? [];
  const routeSelection = routeId || savedRoutes[0]?.id || '';
  const commoditySelection = commodityId || commodities[0]?.id || '';
  const freight = useQuery({
    queryKey: ['business-memory', 'freight', routeSelection, commoditySelection, customerId],
    enabled: kind === 'freight' && Boolean(routeSelection) && Boolean(commoditySelection),
    queryFn: () => apiClient.get<ApiSuccessResponse<BusinessMemoryFreightHistory>>('/intelligence/freight-rates/history', { params: { routeId: routeSelection, commodityId: commoditySelection, ...(customerId ? { customerId } : {}) } }).then(({ data }) => data.data),
  });
  const similar = useQuery({
    queryKey: ['business-memory', 'similar-trips', tripId],
    enabled: kind === 'similar' && Boolean(tripId),
    queryFn: () => apiClient.get<ApiSuccessResponse<BusinessMemorySimilarTrips>>('/intelligence/similar-trips', { params: { tripId } }).then(({ data }) => data.data),
  });
  const noHistory = overview.data?.sampleSize === 0;

  return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Historical intelligence</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Business Memory</h1><p className="mt-2 text-sm text-slate-600">Review past customers, routes, commodities, vehicles, freight and trips. Comparisons use recorded FleetNexus data; they are not predictions.</p></header>
    {overview.isLoading && <p className="text-sm text-slate-500">Loading historical records…</p>}
    {overview.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Business history could not be loaded.</p>}
    {noHistory && <Panel><p className="font-medium">No historical data available yet.</p><p className="mt-1 text-sm text-slate-600">Complete trips and record freight and costs to build Business Memory.</p></Panel>}
    {overview.data && !noHistory && <>
      <Panel><p className="font-medium">{overview.data.sampleSize} completed trips · {overview.data.pricedTripCount} with freight · {confidence(overview.data.confidence)}</p><p className="mt-1 text-sm text-slate-600">{overview.data.explanation}</p></Panel>
      <nav className="flex flex-wrap gap-2">{HISTORY_KINDS.map((item) => <button key={item.key} type="button" onClick={() => { setKind(item.key); setEntityId(''); }} className={`rounded-md px-3 py-2 text-sm font-medium ${kind === item.key ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{item.label}</button>)}</nav>
      {kind !== 'freight' && kind !== 'similar' && <Panel><label className="block text-sm font-medium">Select {({ customers: 'customer', routes: 'route', commodities: 'commodity', vehicles: 'vehicle' })[kind]}<select className="mt-2 block w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedId} onChange={(event) => setEntityId(event.target.value)}><option value="">Choose an item</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.tripCount} trips</option>)}</select></label>{history.isLoading && <p className="mt-4 text-sm text-slate-500">Loading history…</p>}{history.isError && <p role="alert" className="mt-4 text-sm text-red-700">This history could not be loaded.</p>}{history.data && <><p className="mt-4 text-sm text-slate-600">{history.data.explanation}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Trips', history.data.tripCount], ['Revenue', money(history.data.totalRevenue)], ['Payments received', money(history.data.totalPaymentsReceived)], ['Outstanding', money(history.data.outstanding)], ['Expenses', money(history.data.totalExpenses)], ['Profit', money(history.data.totalProfit)], ['Average freight', money(history.data.averageFreightPerTrip)], ['Average profit/trip', money(history.data.averageProfitPerTrip)], ['Average margin', history.data.averageMarginPct == null ? '—' : `${history.data.averageMarginPct.toFixed(1)}%`], ['Average cost/km', money(history.data.averageCostPerKm)], ['Fuel costs', money(history.data.fuelCost)]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><p><strong>Commodities:</strong> {history.data.commodities.join(', ') || '—'}</p><p><strong>Routes:</strong> {history.data.routes.join(', ') || '—'}</p><p><strong>Customers:</strong> {history.data.customers.join(', ') || '—'}</p><p><strong>Vehicles:</strong> {history.data.vehicles.join(', ') || '—'}</p></div><div className="mt-5"><h2 className="mb-3 font-semibold">Recent trips</h2><TripList trips={history.data.recentTrips} /></div></>}</Panel>}
      {kind === 'freight' && <Panel><h2 className="font-semibold">Freight history</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-sm">Route<select className="mt-1 block w-full rounded-md border px-3 py-2" value={routeSelection} onChange={(event) => setRouteId(event.target.value)}>{savedRoutes.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label><label className="text-sm">Commodity<select className="mt-1 block w-full rounded-md border px-3 py-2" value={commoditySelection} onChange={(event) => setCommodityId(event.target.value)}>{commodities.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label><label className="text-sm">Customer (optional)<select className="mt-1 block w-full rounded-md border px-3 py-2" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">All customers</option>{overview.data.customers.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label></div>{!savedRoutes.length && <p className="mt-4 text-sm text-slate-500">Freight history needs trips linked to a saved route and commodity.</p>}{freight.isLoading && <p className="mt-4 text-sm text-slate-500">Loading freight history…</p>}{freight.isError && <p role="alert" className="mt-4 text-sm text-red-700">Freight history could not be loaded.</p>}{freight.data && <><p className="mt-4 text-sm">{freight.data.explanation} · {confidence(freight.data.confidence)}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Comparable trips', freight.data.comparableTripCount], ['Minimum freight', money(freight.data.minimumFreight)], ['Average freight', money(freight.data.averageFreight)], ['Maximum freight', money(freight.data.maximumFreight)], ['Most recent', money(freight.data.mostRecentFreight)], ['Average profit', money(freight.data.averageProfit)], ['Average margin', freight.data.averageMarginPct == null ? '—' : `${freight.data.averageMarginPct.toFixed(1)}%`], ['Saved rate records', freight.data.recordedRateCount]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-4"><TripList trips={freight.data.recentTrips} /></div></>}</Panel>}
      {kind === 'similar' && <Panel><h2 className="font-semibold">Comparable historical trips</h2><label className="mt-3 block max-w-xl text-sm">Reference trip<select className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2" value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">Choose a completed trip</option>{overview.data.historicalTrips.map((trip) => <option key={trip.tripId} value={trip.tripId}>{trip.tripNumber} · {trip.routeLabel} · {new Date(trip.startDate).toLocaleDateString()}</option>)}</select></label>{similar.isLoading && <p className="mt-4 text-sm text-slate-500">Finding comparable trips…</p>}{similar.isError && <p role="alert" className="mt-4 text-sm text-red-700">Similar-trip history could not be loaded.</p>}{similar.data && <><p className="my-3 text-sm text-slate-600">{similar.data.explanation} · {confidence(similar.data.confidence)}</p><TripList trips={similar.data.data} reasons /></>}</Panel>}
    </>}
  </div>;
}
