import TopBar from "@/components/nav/TopBar";
import { api } from "@/lib/api";
import { fmtPct } from "@/lib/utils";
import { ForecastChartWrapper } from "@/components/charts/ForecastChartWrapper";

export const metadata = { title: "Forecast" };

export default async function ForecastPage() {
  const [summary, points] = await Promise.all([
    api.getForecastSummary(),
    api.getForecastPoints(),
  ]);

  return (
    <>
      <TopBar
        title="Forecast"
        subtitle="LightGBM quantile model · 14,370 FOODS series · 28-day horizon"
        actions={
          <a href="/copilot" className="btn btn-secondary btn-sm">Ask about this →</a>
        }
      />

      <div className="page-body">
        {/* ── Accuracy KPIs ───────────────────────────── */}
        <div className="metric-strip" style={{ marginBottom: "var(--sp-8)" }}>
          <div className="metric-cell">
            <div className="metric-label">Model WRMSSE</div>
            <div className="metric-value copper">{summary.wrmsse.toFixed(4)}</div>
            <div className="metric-context">Lower is better</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Seasonal-Naive WRMSSE</div>
            <div className="metric-value" style={{ color: "var(--tx-secondary)" }}>{summary.wrmsse_vs_naive.toFixed(4)}</div>
            <div className="metric-context">Benchmark baseline</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Accuracy Improvement</div>
            <div className="metric-value success">+{summary.wrmsse_improvement_pct.toFixed(1)}%</div>
            <div className="metric-context">vs seasonal-naive</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Mean Pinball Loss</div>
            <div className="metric-value">{summary.mean_pinball.toFixed(4)}</div>
            <div className="metric-context">Quantile calibration</div>
          </div>
        </div>

        {/* ── Forecast Timeline Chart ──────────────────── */}
        <div className="section">
          <div className="section-hdr">
            <div>
              <div className="section-title">Forecast Timeline — FOODS_1_001 · CA_1</div>
              <div className="section-sub">
                {points.filter((p) => p.actual !== undefined).length} days actuals (green) ·{" "}
                {points.filter((p) => p.actual === undefined).length} days forecast (copper bands: q50 / q90 / q95 / q99)
              </div>
            </div>
          </div>
          <div className="panel" style={{ overflow: "hidden" }}>
            <div style={{ padding: "var(--sp-4) var(--sp-4) var(--sp-2)" }}>
              <ForecastChartWrapper data={points} />
            </div>
            <div style={{
              padding: "var(--sp-3) var(--sp-5)",
              borderTop: "1px solid var(--divider)",
              background: "var(--surface-raised)",
              display: "flex", gap: "var(--sp-6)", flexWrap: "wrap",
              fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)",
            }}>
              {[
                { color: "#2A6B47", label: "Actual demand" },
                { color: "#A85820", label: "q50 median forecast", dash: false },
                { color: "#BE7038", label: "q90 band" },
                { color: "#D29464", label: "q95 band" },
                { color: "#E5BF99", label: "q99 band" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: l.color, borderRadius: 1 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Quantile data table ──────────────────────── */}
        <div className="section">
          <div className="section-hdr">
            <div className="section-title">Raw Quantile Data</div>
            <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>First 14 rows shown</div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">q50</th>
                  <th className="text-right">q80</th>
                  <th className="text-right">q90</th>
                  <th className="text-right">q95</th>
                  <th className="text-right">q99</th>
                  <th className="text-right">Actual</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {points.slice(0, 14).map((p) => {
                  const isFuture = p.actual === undefined;
                  const inBand = p.actual != null && p.actual <= p.q90;
                  return (
                    <tr key={p.date} style={isFuture ? { background: "var(--surface-raised)" } : {}}>
                      <td style={{ fontFamily: "var(--ff-mono)", fontSize: "var(--ts-xs)", color: isFuture ? "var(--cu-600)" : "var(--tx-primary)" }}>
                        {p.date}
                        {isFuture && <span className="badge badge-copper" style={{ marginLeft: "var(--sp-2)", fontSize: 10 }}>forecast</span>}
                      </td>
                      <td className="text-right mono">{p.q50.toFixed(1)}</td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>{p.q80.toFixed(1)}</td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>{p.q90.toFixed(1)}</td>
                      <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>{p.q95.toFixed(1)}</td>
                      <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>{p.q99.toFixed(1)}</td>
                      <td className="text-right mono" style={{ fontWeight: "var(--fw-semibold)" }}>
                        {p.actual != null ? p.actual.toFixed(1) : <span style={{ color: "var(--tx-disabled)" }}>—</span>}
                      </td>
                      <td>
                        {p.actual != null && (
                          <span className={`badge ${inBand ? "badge-ok" : "badge-warning"}`}>
                            {inBand ? "In q90" : "Outside q90"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Quantile explainer ──────────────────────── */}
        <div className="section">
          <div className="section-hdr">
            <div className="section-title">How Quantiles Drive Inventory Decisions</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--sp-4)" }}>
            {[
              { q: "q50", label: "Median",        desc: "50% coverage. Minimum viable stock — expect stockouts on busy days.",          color: "var(--tx-primary)" },
              { q: "q80", label: "80th pctile",   desc: "80% coverage. Moderate buffer for routine variance.",                          color: "var(--wn-500)" },
              { q: "q90", label: "90th pctile",   desc: "90% coverage. Good starting point for most retail operations.",                color: "var(--cu-500)" },
              { q: "q95", label: "95th pctile",   desc: "Default operating point. Balances service level against carrying cost.",       color: "var(--ok-500)" },
              { q: "q99", label: "99th pctile",   desc: "Near-guarantee. High stock, near-zero stockouts. Use for critical items only.",color: "var(--in-500)" },
            ].map((item) => (
              <div key={item.q} style={{
                padding: "var(--sp-4)", background: "var(--surface)",
                border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                borderTop: `3px solid ${item.color}`,
              }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-xl)", fontWeight: "var(--fw-bold)", color: item.color, letterSpacing: "var(--ls-tight)", marginBottom: "var(--sp-1)" }}>
                  {item.q}
                </div>
                <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", color: "var(--tx-secondary)", marginBottom: "var(--sp-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", lineHeight: "var(--lh-relaxed)" }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pinball loss breakdown ───────────────────── */}
        <div className="section">
          <div className="section-hdr">
            <div className="section-title">Pinball Loss per Quantile</div>
            <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>Lower = better calibrated for that service level</div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Quantile</th>
                  <th className="text-right">Pinball Loss</th>
                  <th>Interpretation</th>
                  <th style={{ width: 200 }}>Quality bar</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { q: "q50", loss: 0.648, note: "Median — symmetric loss (α = 0.5)" },
                  { q: "q80", loss: 0.626, note: "Slightly better than median" },
                  { q: "q90", loss: 0.550, note: "Strong upper-tail coverage" },
                  { q: "q95", loss: 0.456, note: "Very well calibrated at the key operating level" },
                  { q: "q99", loss: 0.253, note: "Excellent extreme-tail coverage" },
                ].map((row) => {
                  const quality = ((0.70 - row.loss) / 0.70) * 100;
                  return (
                    <tr key={row.q}>
                      <td className="mono" style={{ fontWeight: "var(--fw-semibold)", color: "var(--cu-600)" }}>{row.q}</td>
                      <td className="text-right mono">{row.loss.toFixed(4)}</td>
                      <td style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)" }}>{row.note}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                          <div style={{ flex: 1, height: 6, background: "var(--canvas)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(quality, 5)}%`, height: "100%", background: "var(--cu-400)", borderRadius: "var(--r-full)" }} />
                          </div>
                          <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", minWidth: 36, textAlign: "right" }}>
                            {quality.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
