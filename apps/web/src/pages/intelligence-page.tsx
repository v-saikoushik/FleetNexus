import { BarChart3, TrendingUp, Truck, Map, Fuel, Calendar, AlertTriangle } from 'lucide-react';

export function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          Coming soon — FleetNexus will learn from your historical trips, routes, expenses, and seasonal patterns.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Profitability Prediction</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Predict load profitability, per-km revenue, and trip costs based on your history.
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Seasonal Intelligence</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Discover profitable seasons and track commodity demand trends.
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Load Recommendations</h3>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Get smart recommendations on which loads to accept, review, or avoid.
            </p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Route Intelligence</h3>
            <Map className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Analyze historical distance, toll costs, and the best seasons for any route.
            </p>
          </div>
        </div>

        {/* Card 5 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Vehicle Recommendations</h3>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Find the best vehicle for a load based on capacity and historical efficiency.
            </p>
          </div>
        </div>

        {/* Card 6 */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Fuel & Anomaly Detection</h3>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Estimate expected range and automatically identify unusual fuel bills or toll costs.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-6 bg-muted/20">
        <h3 className="font-semibold text-lg flex items-center">
          <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
          Data Foundation First
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          True intelligence requires reliable data. As you use FleetNexus to manage your vehicles, loads, fuel, and expenses, the system is building your unique <strong>Business Memory</strong>. This historical data is the foundation for all future predictions.
        </p>
      </div>
    </div>
  );
}
