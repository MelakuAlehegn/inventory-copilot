import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { fmtCurrency, fmtNumber } from "@/lib/utils";
import { TopBar } from "@/components/app/top-bar";
import { Kpi, KpiStrip, Panel, PanelHeader, fmt } from "@/components/app/primitives";
import { StoreBarChart } from "@/components/charts/StoreBarChart";
import { ExportCsvButton } from "@/components/app/export-csv-button";

export const metadata = { title: "Analytics" };

// Display-only category derived from the M5 item id prefix (e.g. FOODS_1_001 -> FOODS_1).
function categoryOf(itemId: string): string {
  const parts = itemId.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : itemId;
}

export default async function AnalyticsPage() {
  const session = await auth();
  const api = apiClient(session?.backendToken);

  let data;
  try {
    const [kpis, topItems, stores] = await Promise.all([
      api.getKPIs(),
      api.getTopSeries("revenue", 12),
      api.getStores(),
    ]);
    data = { kpis, topItems, stores };
  } catch {
    return (
      <>
        <TopBar title="Analytics" subtitle="DuckDB over baked M5 Parquet" />
        <div className="p-6">
          <Panel className="flex flex-col items-center gap-2 px-6 py-20 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load data</p>
            <p className="text-xs text-muted-foreground">The backend could not be reached. Please try again.</p>
          </Panel>
        </div>
      </>
    );
  }

  const { kpis, topItems, stores } = data;
  const sortedStores = [...stores].sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0));

  return (
    <>
      <TopBar title="Analytics" subtitle={`M5 Walmart FOODS · ${kpis.start_date} → ${kpis.end_date}`} />

      <div className="space-y-5 p-6">
        <KpiStrip>
          <Kpi label="Series" value={fmt(kpis.n_series)} hint="Item × store combinations" />
          <Kpi label="Stores" value={fmt(kpis.n_stores)} hint="CA · TX · WI" />
          <Kpi label="Total units" value={fmt(kpis.total_units)} tone="primary" hint="Across the eval window" />
          <Kpi label="Total revenue" value={fmtCurrency(kpis.total_revenue)} tone="success" hint="Sell price × units" />
        </KpiStrip>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="Units by store" subtitle="Totals across the eval window" />
            <StoreBarChart data={sortedStores} />
          </Panel>

          <Panel>
            <PanelHeader
              title="Top series by revenue"
              subtitle="Highest revenue across item × store"
              action={<ExportCsvButton filename="top-series" rows={topItems.map((r) => ({ item: r.item_id, category: categoryOf(r.item_id), store: r.store_id, revenue: r.revenue ?? "", units: r.units }))} />}
            />
            <div className="max-h-[344px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left">
                    {["Item", "Category", "Store", "Revenue", "Units"].map((h, i) => (
                      <th key={h} className={`label-eyebrow px-5 py-2.5 ${i > 2 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((r) => (
                    <tr key={r.unique_id} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="num px-5 py-2 text-[13px]">{r.item_id}</td>
                      <td className="px-5 py-2">
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{categoryOf(r.item_id)}</span>
                      </td>
                      <td className="num px-5 py-2 text-[13px] text-muted-foreground">{r.store_id}</td>
                      <td className="num px-5 py-2 text-right text-[13px] font-semibold">{r.revenue != null ? fmtCurrency(r.revenue) : "-"}</td>
                      <td className="num px-5 py-2 text-right text-[13px] text-muted-foreground">{fmtNumber(r.units)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Store breakdown"
            subtitle="Units, revenue and series count per location"
            action={<ExportCsvButton filename="store-breakdown" rows={sortedStores.map((r) => ({ store: r.store_id, series: r.n_series, units: r.total_units, revenue: r.total_revenue ?? "" }))} />}
          />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Store", "Series", "Units", "Revenue", "Revenue / series"].map((h, i) => (
                  <th key={h} className={`label-eyebrow px-5 py-2.5 ${i > 0 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStores.map((r) => (
                <tr key={r.store_id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="num px-5 py-2.5 text-[13px]">{r.store_id}</td>
                  <td className="num px-5 py-2.5 text-right text-[13px] text-muted-foreground">{fmt(r.n_series)}</td>
                  <td className="num px-5 py-2.5 text-right text-[13px]">{fmt(r.total_units)}</td>
                  <td className="num px-5 py-2.5 text-right text-[13px] font-medium">{r.total_revenue != null ? fmtCurrency(r.total_revenue) : "-"}</td>
                  <td className="num px-5 py-2.5 text-right text-[13px] text-muted-foreground">
                    {r.total_revenue != null && r.n_series ? fmtCurrency(Math.round(r.total_revenue / r.n_series)) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
