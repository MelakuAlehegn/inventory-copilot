import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import type { ForecastPoint } from "@/lib/types";
import { TopBar } from "@/components/app/top-bar";
import { Kpi, KpiStrip, Panel } from "@/components/app/primitives";
import { ForecastSeriesPanel } from "@/components/forecast/ForecastSeriesPanel";

export const metadata = { title: "Forecast" };

export default async function ForecastPage() {
  const session = await auth();
  const api = apiClient(session?.backendToken);

  let data;
  try {
    const [summary, options] = await Promise.all([
      api.getForecastSummary(),
      api.getSeriesOptions(),
    ]);
    // Default to the first available series (cheap; no group-by scan).
    const initialItem = options.items[0] ?? "";
    const initialStore = options.stores[0] ?? "";
    let points: ForecastPoint[] = [];
    try {
      const series = initialItem && initialStore
        ? await api.getForecastSeries(`${initialItem}_${initialStore}`)
        : null;
      points = series?.points ?? [];
    } catch {
      points = [];
    }
    data = { summary, options, initialItem, initialStore, points };
  } catch {
    return (
      <>
        <TopBar title="Forecast" subtitle="LightGBM quantile model" />
        <div className="p-6">
          <Panel className="flex flex-col items-center gap-2 px-6 py-20 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load data</p>
            <p className="text-xs text-muted-foreground">The backend could not be reached. Please try again.</p>
          </Panel>
        </div>
      </>
    );
  }

  const { summary, options, initialItem, initialStore, points } = data;

  return (
    <>
      <TopBar
        title="Forecast"
        subtitle={`LightGBM quantile model · ${summary.n_series.toLocaleString()} FOODS series`}
      />

      <div className="space-y-5 p-6">
        <KpiStrip>
          <Kpi label="Model WRMSSE" value={summary.wrmsse_model.toFixed(4)} tone="primary" hint="Weighted RMSSE, lower is better" />
          <Kpi label="Seasonal-naive" value={summary.wrmsse_naive.toFixed(4)} hint="Baseline reference" />
          <Kpi label="Improvement" value={`+${(summary.wrmsse_improvement * 100).toFixed(1)}%`} tone="success" hint="vs seasonal-naive" />
          <Kpi label="Mean pinball loss" value={summary.pinball_mean.toFixed(4)} hint="Across q50-q99" />
        </KpiStrip>

        <ForecastSeriesPanel
          items={options.items}
          stores={options.stores}
          initialItem={initialItem}
          initialStore={initialStore}
          initialPoints={points}
        />
      </div>
    </>
  );
}
