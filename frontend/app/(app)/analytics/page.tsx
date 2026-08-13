import TopBar from "@/components/nav/TopBar";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

export const metadata = { title: "Analytics" };

// Display-only category derived from the M5 item id prefix (e.g. FOODS_1_001 -> FOODS_1).
function categoryOf(itemId: string): string {
  const parts = itemId.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : itemId;
}

export default async function AnalyticsPage() {
  const session = await auth();
  const api = apiClient(session?.backendToken);

  try {
    const [kpis, topItems, stores] = await Promise.all([
      api.getKPIs(),
      api.getTopSeries("revenue", 12),
      api.getStores(),
    ]);

    const totalStoreRevenue = stores.reduce((s, st) => s + (st.total_revenue ?? 0), 0);
    const sortedStores = [...stores].sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0));

    return (
      <>
        <TopBar
          title="Analytics"
          subtitle="DuckDB over baked M5 Parquet · FOODS × stores"
          actions={
            <a href="/copilot" className="btn btn-secondary btn-sm">
              Query with Copilot →
            </a>
          }
        />

        <div className="page-body">
          {/* ── Summary ──────────────────────────────────── */}
          <div className="metric-strip" style={{ marginBottom: "var(--sp-8)", gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="metric-cell">
              <div className="metric-label">Total Revenue (Holdout)</div>
              <div className="metric-value copper">{fmtCurrency(kpis.total_revenue)}</div>
              <div className="metric-context">{kpis.start_date} → {kpis.end_date}</div>
            </div>
            <div className="metric-cell">
              <div className="metric-label">Total Units Sold</div>
              <div className="metric-value">{fmtNumber(kpis.total_units)}</div>
              <div className="metric-context">Across {kpis.n_stores} stores</div>
            </div>
            <div className="metric-cell">
              <div className="metric-label">Avg Daily Demand</div>
              <div className="metric-value success">{kpis.avg_daily_demand.toFixed(1)}</div>
              <div className="metric-context">Units per series per day</div>
            </div>
          </div>

          <div className="two-col" style={{ alignItems: "start" }}>
            {/* ── Top Items ──────────────────────────────── */}
            <div className="section">
              <div className="section-hdr">
                <div>
                  <div className="section-title">Top Series by Revenue</div>
                  <div className="section-sub">FOODS category · item × store</div>
                </div>
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Store</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item, i) => (
                      <tr key={item.unique_id}>
                        <td style={{ color: "var(--tx-tertiary)", fontSize: "var(--ts-xs)", fontWeight: "var(--fw-bold)", width: 32 }}>
                          {i + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--ts-sm)" }}>{item.item_id}</div>
                        </td>
                        <td><span className="badge badge-neutral">{categoryOf(item.item_id)}</span></td>
                        <td style={{ color: "var(--tx-secondary)", fontFamily: "var(--ff-mono)", fontSize: "var(--ts-sm)" }}>{item.store_id}</td>
                        <td className="text-right mono" style={{ fontWeight: "var(--fw-semibold)" }}>
                          {item.revenue != null ? fmtCurrency(item.revenue) : "—"}
                        </td>
                        <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                          {fmtNumber(item.units)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Stores ─────────────────────────────────── */}
            <div className="section">
              <div className="section-hdr">
                <div>
                  <div className="section-title">Store Performance</div>
                  <div className="section-sub">Revenue, volume, and series count by location</div>
                </div>
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th className="text-right">Series</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Units</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStores.map((store) => {
                      const revShare = totalStoreRevenue > 0 ? (store.total_revenue ?? 0) / totalStoreRevenue : 0;
                      return (
                        <tr key={store.store_id}>
                          <td style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--ts-sm)", fontFamily: "var(--ff-mono)" }}>
                            {store.store_id}
                          </td>
                          <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                            {fmtNumber(store.n_series)}
                          </td>
                          <td className="text-right mono" style={{ fontWeight: "var(--fw-semibold)" }}>
                            {store.total_revenue != null ? fmtCurrency(store.total_revenue) : "—"}
                          </td>
                          <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                            {fmtNumber(store.total_units)}
                          </td>
                          <td style={{ minWidth: 100 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                              <div style={{ flex: 1, height: 5, background: "var(--canvas)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                                <div style={{ width: `${revShare * 100}%`, height: "100%", background: "var(--cu-400)", borderRadius: "var(--r-full)" }} />
                              </div>
                              <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", minWidth: 36, textAlign: "right" }}>
                                {(revShare * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── What copilot can answer ──────────────── */}
              <div style={{ marginTop: "var(--sp-6)", padding: "var(--sp-5)", background: "var(--cu-50)", border: "1px solid var(--cu-200)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "var(--ts-sm)", fontWeight: "var(--fw-semibold)", color: "var(--cu-700)", marginBottom: "var(--sp-3)" }}>
                  Ask the Copilot
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                  {[
                    "Which store has the highest revenue?",
                    "Top 5 series by revenue across all stores?",
                    "What is the total FOODS revenue?",
                    "How does CA_1 compare to TX_1 in units sold?",
                  ].map((q) => (
                    <a
                      key={q}
                      href={`/copilot?q=${encodeURIComponent(q)}`}
                      style={{ fontSize: "var(--ts-sm)", color: "var(--cu-600)", textDecoration: "underline", textDecorationColor: "var(--cu-200)" }}
                    >
                      → {q}
                    </a>
                  ))}
                </div>
                <div style={{ marginTop: "var(--sp-3)", fontSize: "var(--ts-xs)", color: "var(--cu-700)", opacity: 0.7 }}>
                  Copilot queries DuckDB over the baked Parquet. Stockout history is not in M5 — those questions route to simulation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  } catch {
    return (
      <>
        <TopBar title="Analytics" subtitle="DuckDB over baked M5 Parquet" />
        <div className="page-body">
          <div className="empty">
            <div className="empty-title">Couldn&apos;t load data.</div>
            <p className="empty-desc">The backend could not be reached. Please try again.</p>
          </div>
        </div>
      </>
    );
  }
}
