import TopBar from "@/components/nav/TopBar";
import { api } from "@/lib/api";
import { fmtCurrency, fmtNumber, fmtPct } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const [topItems, stores] = await Promise.all([
    api.getTopItems(12),
    api.getStoreMetrics(),
  ]);

  const totalRevenue = stores.reduce((s, st) => s + st.total_revenue, 0);
  const totalUnits   = stores.reduce((s, st) => s + st.total_units, 0);
  const avgFillRate  = stores.reduce((s, st) => s + st.fill_rate, 0) / stores.length;

  return (
    <>
      <TopBar
        title="Analytics"
        subtitle="DuckDB over baked M5 Parquet · FOODS × 10 stores"
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
            <div className="metric-value copper">{fmtCurrency(totalRevenue)}</div>
            <div className="metric-context">28-day simulation period</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Total Units Sold</div>
            <div className="metric-value">{fmtNumber(totalUnits)}</div>
            <div className="metric-context">Across {stores.length} stores</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Avg Fill Rate</div>
            <div className="metric-value success">{fmtPct(avgFillRate)}</div>
            <div className="metric-context">Volume-weighted across stores</div>
          </div>
        </div>

        <div className="two-col" style={{ alignItems: "start" }}>
          {/* ── Top Items ──────────────────────────────── */}
          <div className="section">
            <div className="section-hdr">
              <div>
                <div className="section-title">Top Items by Revenue</div>
                <div className="section-sub">FOODS category · all stores combined</div>
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Avg Daily</th>
                    <th className="text-right">Stores</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, i) => (
                    <tr key={item.item_id}>
                      <td style={{ color: "var(--tx-tertiary)", fontSize: "var(--ts-xs)", fontWeight: "var(--fw-bold)", width: 32 }}>
                        {i + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--ts-sm)" }}>{item.item_id}</div>
                        <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>{item.name}</div>
                      </td>
                      <td><span className="badge badge-neutral">{item.category}</span></td>
                      <td className="text-right mono" style={{ fontWeight: "var(--fw-semibold)" }}>
                        {fmtCurrency(item.total_revenue)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                        {fmtNumber(item.total_units)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                        {item.avg_daily_sales.toFixed(0)}
                      </td>
                      <td className="text-right" style={{ color: "var(--tx-tertiary)" }}>
                        {item.store_count}
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
                <div className="section-sub">Revenue, volume, and fill rate by location</div>
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>State</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Fill Rate</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {stores
                    .sort((a, b) => b.total_revenue - a.total_revenue)
                    .map((store) => {
                      const revShare = store.total_revenue / totalRevenue;
                      return (
                        <tr key={store.store_id}>
                          <td style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--ts-sm)", fontFamily: "var(--ff-mono)" }}>
                            {store.store_id}
                          </td>
                          <td style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)" }}>{store.state}</td>
                          <td className="text-right mono" style={{ fontWeight: "var(--fw-semibold)" }}>
                            {fmtCurrency(store.total_revenue)}
                          </td>
                          <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                            {fmtNumber(store.total_units)}
                          </td>
                          <td className="text-right">
                            <span style={{
                              fontWeight: "var(--fw-semibold)",
                              color: store.fill_rate >= 0.93 ? "var(--ok-text)" : store.fill_rate >= 0.92 ? "var(--wn-text)" : "var(--dn-text)",
                            }}>
                              {fmtPct(store.fill_rate)}
                            </span>
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
                  "Which store has the highest fill rate?",
                  "Top 5 items by revenue across all stores?",
                  "What is the total FOODS revenue in California?",
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
}
