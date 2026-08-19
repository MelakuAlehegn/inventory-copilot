import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { TopBar } from "@/components/app/top-bar";
import { Kpi, KpiStrip, Panel, PanelHeader } from "@/components/app/primitives";
import { ForecastChartWrapper } from "@/components/charts/ForecastChartWrapper";

export const metadata = { title: "Forecast" };

const quantileGuide = [
  { q: "q50", title: "Median", body: "50% coverage. Minimum viable stock; expect stockouts on busy days." },
  { q: "q80", title: "80th pctile", body: "80% coverage. Moderate buffer for routine variance." },
  { q: "q90", title: "90th pctile", body: "90% coverage. A good starting point for most retail operations." },
  { q: "q95", title: "95th pctile", body: "Default operating point. Balances service level against carrying cost." },
  { q: "q99", title: "99th pctile", body: "Near-guarantee. High stock, near-zero stockouts. Critical items only." },
];

export default async function ForecastPage() {
  const session = await auth();
  const api = apiClient(session?.backendToken);

  let data;
  try {
    const [summary, topSeries] = await Promise.all([
      api.getForecastSummary(),
      api.getTopSeries("units", 1),
    ]);
    const lead = topSeries[0];
    const series = lead ? await api.getForecastSeries(lead.unique_id) : null;
    data = { summary, lead, points: series?.points ?? [] };
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

  const { summary, lead, points } = data;
  const nActual = points.filter((p) => p.actual != null).length;
  const nForecast = points.length - nActual;

  return (
    <>
      <TopBar
        title="Forecast"
        subtitle={`LightGBM quantile model · ${summary.n_series.toLocaleString()} FOODS series${lead ? ` · ${lead.item_id} @ ${lead.store_id}` : ""}`}
      />

      <div className="space-y-5 p-6">
        <KpiStrip>
          <Kpi label="Model WRMSSE" value={summary.wrmsse_model.toFixed(4)} tone="primary" hint="Weighted RMSSE, lower is better" />
          <Kpi label="Seasonal-naive" value={summary.wrmsse_naive.toFixed(4)} hint="Baseline reference" />
          <Kpi label="Improvement" value={`+${(summary.wrmsse_improvement * 100).toFixed(1)}%`} tone="success" hint="vs seasonal-naive" />
          <Kpi label="Mean pinball loss" value={summary.pinball_mean.toFixed(4)} hint="Across q50–q99" />
        </KpiStrip>

        <Panel>
          <PanelHeader
            title="Quantile fan"
            subtitle={`${nActual} days actuals · ${nForecast} days forecast`}
            action={
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-success" /> Actual</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> q50</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-copper-200" /> q80–q99</span>
              </div>
            }
          />
          {points.length > 0 ? (
            <ForecastChartWrapper data={points} />
          ) : (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">No forecast series available.</p>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Panel>
            <PanelHeader title="Raw quantile data" subtitle="First 14 days · actuals vs q90 coverage" />
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left">
                    {["Date", "q50", "q80", "q90", "q95", "q99", "Actual", "Coverage"].map((h, i) => (
                      <th key={h} className={`label-eyebrow px-4 py-2.5 ${i > 0 && i < 7 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points.slice(0, 14).map((p) => {
                    const isFuture = p.actual == null;
                    const inBand = p.actual != null && p.actual <= p.q90;
                    return (
                      <tr key={p.ds} className={`border-b border-border last:border-0 hover:bg-surface-2 ${isFuture ? "bg-surface-2/50" : ""}`}>
                        <td className="num px-4 py-2 text-[12px] text-muted-foreground">
                          {p.ds}
                          {isFuture ? <span className="num ml-2 rounded bg-copper-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary">fcst</span> : null}
                        </td>
                        <td className="num px-4 py-2 text-right text-[13px] font-medium text-primary">{p.q50.toFixed(1)}</td>
                        <td className="num px-4 py-2 text-right text-[13px]">{p.q80.toFixed(1)}</td>
                        <td className="num px-4 py-2 text-right text-[13px]">{p.q90.toFixed(1)}</td>
                        <td className="num px-4 py-2 text-right text-[13px] text-muted-foreground">{p.q95.toFixed(1)}</td>
                        <td className="num px-4 py-2 text-right text-[13px] text-muted-foreground">{p.q99.toFixed(1)}</td>
                        <td className="num px-4 py-2 text-right text-[13px] font-semibold">
                          {p.actual != null ? p.actual.toFixed(1) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-4 py-2">
                          {p.actual != null ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${inBand ? "border-success/25 bg-success-soft text-success-foreground" : "border-warning/25 bg-warning-soft text-warning-foreground"}`}>
                              {inBand ? "In q90" : "Outside q90"}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Reading the quantiles" subtitle="What each band means for stocking decisions" />
            <div className="divide-y divide-border">
              {quantileGuide.map((g) => (
                <div key={g.q} className="px-5 py-4">
                  <div className="flex items-baseline gap-2">
                    <span className="num rounded bg-copper-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{g.q}</span>
                    <p className="text-sm font-medium">{g.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{g.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
