import TopBar from "@/components/nav/TopBar";
import { api } from "@/lib/api";
import { fmtPct, fmtNumber } from "@/lib/utils";
import { AlertTriangle, TrendingUp, Package, Zap } from "lucide-react";
import Link from "next/link";
import { ParetoChartWrapper } from "@/components/charts/ParetoChartWrapper";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [kpis, inventory, pareto] = await Promise.all([
    api.getKPIs(),
    api.getInventory(),
    api.getPareto(),
  ]);

  const critical = inventory.filter((i) => i.status === "critical");
  const reorder  = inventory.filter((i) => i.status === "reorder");
  const basePareto  = pareto.filter((p) => p.policy === "base_stock");
  const naivePareto = pareto.filter((p) => p.policy === "naive");

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="M5 Walmart FOODS · 14,370 series · 28-day horizon"
      />

      <div className="page-body">
        {/* ── Alert banner ──────────────────────────────── */}
        {critical.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--sp-4)",
            padding: "var(--sp-3) var(--sp-4)",
            background: "var(--dn-bg)", border: "1px solid #E8AAAA",
            borderRadius: "var(--r-md)", marginBottom: "var(--sp-6)",
            fontSize: "var(--ts-sm)",
          }}>
            <AlertTriangle size={16} color="var(--dn-500)" />
            <span>
              <strong style={{ color: "var(--dn-text)" }}>{critical.length} items critical</strong>
              <span style={{ color: "var(--tx-secondary)" }}> — stockout imminent. Review reorder queue.</span>
            </span>
            <Link href="/inventory?status=critical" className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }}>
              View Critical
            </Link>
          </div>
        )}

        {/* ── KPI strip ─────────────────────────────────── */}
        <div className="metric-strip" style={{ marginBottom: "var(--sp-8)" }}>
          <div className="metric-cell">
            <div className="metric-label">Forecast Accuracy Gain</div>
            <div className="metric-value copper">+{kpis.forecast_improvement_pct.toFixed(1)}%</div>
            <div className="metric-context">vs seasonal-naive WRMSSE</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Mean Fill Rate</div>
            <div className="metric-value success">{fmtPct(kpis.mean_fill_rate)}</div>
            <div className="metric-context">
              <span style={{ color: "var(--ok-text)", fontWeight: "var(--fw-semibold)" }}>↑ +0.9%</span>
              &nbsp;vs naive baseline
            </div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Stockout Risk Items</div>
            <div className="metric-value danger">{kpis.items_at_risk}</div>
            <div className="metric-context">{critical.length} critical · {reorder.length} reorder soon</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Cost Reduction</div>
            <div className="metric-value">−{kpis.cost_reduction_pct.toFixed(1)}%</div>
            <div className="metric-context">vs naive baseline total cost</div>
          </div>
        </div>

        {/* ── Main two-column layout ────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--sp-8)", alignItems: "start" }}>

          {/* Left col */}
          <div>
            {/* Reorder queue */}
            <div className="section">
              <div className="section-hdr">
                <div>
                  <div className="section-title">Reorder Queue</div>
                  <div className="section-sub">{reorder.length + critical.length} items need attention</div>
                </div>
                <Link href="/inventory" className="btn btn-ghost btn-sm">All inventory →</Link>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Store</th>
                      <th className="text-right">Stock</th>
                      <th className="text-right">Reorder Pt.</th>
                      <th className="text-right">Days Left</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...critical, ...reorder].slice(0, 10).map((item) => (
                      <tr key={`${item.item_id}-${item.store_id}`}>
                        <td>
                          <div style={{ fontWeight: "var(--fw-medium)" }}>{item.item_id}</div>
                          <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>{item.name}</div>
                        </td>
                        <td style={{ color: "var(--tx-secondary)" }}>{item.store_id}</td>
                        <td className="text-right mono">{fmtNumber(item.current_stock)}</td>
                        <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>{fmtNumber(item.reorder_point)}</td>
                        <td className="text-right">
                          {item.days_until_stockout != null ? (
                            <span style={{
                              fontWeight: "var(--fw-semibold)",
                              color: item.days_until_stockout <= 3 ? "var(--dn-text)" : "var(--wn-text)",
                            }}>
                              {item.days_until_stockout}d
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          <span className={`badge badge-${item.status === "critical" ? "danger" : "warning"}`}>
                            <span className={`dot dot-${item.status === "critical" ? "danger" : "warning"}`} />
                            {item.status === "critical" ? "Critical" : "Reorder"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Pareto Chart ────────────────────────────── */}
            <div className="section">
              <div className="section-hdr">
                <div>
                  <div className="section-title">Service vs Cost — Pareto Frontier</div>
                  <div className="section-sub">Base-stock dominates naive at every service level ≥ 95% — better fill rate AND lower combined cost</div>
                </div>
                <Link href="/scenarios" className="btn btn-ghost btn-sm">Explore →</Link>
              </div>
              {/* Client chart wrapper (recharts needs client) */}
              <ParetoChartWrapper data={pareto} />

              {/* Pareto table below chart */}
              <div className="tbl-wrap" style={{ marginTop: "var(--sp-4)" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Service Target</th>
                      <th className="text-right">Base-Stock Fill</th>
                      <th className="text-right">Naive Fill</th>
                      <th className="text-right">Base-Stock Cost</th>
                      <th className="text-right">Naive Cost</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {basePareto.map((bp) => {
                      const np = naivePareto.find((n) => n.service_level === bp.service_level);
                      const wins = bp.fill_rate >= (np?.fill_rate ?? 0) && bp.combined_cost <= (np?.combined_cost ?? Infinity);
                      return (
                        <tr key={bp.service_level}>
                          <td className="mono" style={{ fontWeight: "var(--fw-medium)" }}>
                            {(bp.service_level * 100).toFixed(0)}%
                          </td>
                          <td className="text-right mono" style={{ color: "var(--ok-text)", fontWeight: "var(--fw-semibold)" }}>
                            {fmtPct(bp.fill_rate)}
                          </td>
                          <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>
                            {np ? fmtPct(np.fill_rate) : "—"}
                          </td>
                          <td className="text-right mono">${(bp.combined_cost / 1000).toFixed(1)}k</td>
                          <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>
                            {np ? `$${(np.combined_cost / 1000).toFixed(1)}k` : "—"}
                          </td>
                          <td>
                            {wins ? (
                              <span className="badge badge-ok">Base-stock wins</span>
                            ) : (
                              <span className="badge badge-neutral">Comparable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right col */}
          <div>
            {/* Policy performance */}
            <div className="section">
              <div className="section-hdr">
                <div className="section-title">Policy Comparison</div>
                <Link href="/scenarios" className="btn btn-ghost btn-sm">What-if →</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { label: "Fill Rate",          base: "93.2%",   naive: "92.3%"  },
                  { label: "Stockout Units",     base: "56,992",  naive: "64,150" },
                  { label: "Stockout-Day Rate",  base: "3.5%",    naive: "4.3%"   },
                  { label: "Avg On-Hand",        base: "20.6",    naive: "21.2"   },
                  { label: "Total Cost",         base: "$804.6k", naive: "$829.3k"},
                ].map((row) => (
                  <div key={row.label} style={{
                    display: "flex", alignItems: "baseline", gap: "var(--sp-3)",
                    padding: "var(--sp-3) 0", borderBottom: "1px solid var(--divider)",
                  }}>
                    <span style={{ flex: 1, fontSize: "var(--ts-sm)", color: "var(--tx-secondary)" }}>{row.label}</span>
                    <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }} className="mono">{row.naive}</span>
                    <span style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-sm)", fontWeight: "var(--fw-bold)", minWidth: 64, textAlign: "right" }} className="mono">{row.base}</span>
                    <span style={{ fontSize: "var(--ts-xs)", color: "var(--ok-text)", fontWeight: "var(--fw-semibold)", minWidth: 16 }}>✓</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", marginTop: "var(--sp-3)" }}>
                Base-stock vs naive · 95% service level · 14,370 series
              </div>
            </div>

            {/* Headline stats */}
            <div className="section">
              <div className="section-hdr">
                <div className="section-title">Headline Numbers</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
                {[
                  { icon: TrendingUp, label: "WRMSSE Improvement",  value: "+19.6%",  sub: "LightGBM vs seasonal-naive" },
                  { icon: Package,    label: "Stockout Reduction",   value: "−11.2%", sub: "Forecast vs naive policy"   },
                  { icon: Zap,        label: "Series Processed",     value: "14,370",  sub: "FOODS × 10 stores"          },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-start" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "var(--r-sm)",
                        background: "var(--cu-50)", display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0, marginTop: 2,
                      }}>
                        <Icon size={15} color="var(--cu-500)" />
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                          {s.label}
                        </div>
                        <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-xl)", fontWeight: "var(--fw-bold)", color: "var(--cu-500)", letterSpacing: "var(--ls-tight)" }}>
                          {s.value}
                        </div>
                        <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>{s.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick ask */}
            <div style={{ padding: "var(--sp-4) var(--sp-5)", background: "var(--cu-50)", border: "1px solid var(--cu-200)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--cu-700)", marginBottom: "var(--sp-3)" }}>
                Ask the Copilot
              </div>
              {[
                "Why does base-stock beat naive?",
                "What if demand rises 30%?",
                "Compare 95% vs 99% service level",
              ].map((q) => (
                <Link
                  key={q}
                  href={`/copilot?q=${encodeURIComponent(q)}`}
                  style={{ display: "block", fontSize: "var(--ts-sm)", color: "var(--cu-600)", marginBottom: "var(--sp-2)", textDecoration: "underline", textDecorationColor: "var(--cu-200)" }}
                >
                  → {q}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
