"use client";

import { useState, useCallback } from "react";
import TopBar from "@/components/nav/TopBar";
import { api } from "@/lib/api";
import { fmtPct, fmtCurrency } from "@/lib/utils";
import type { ScenarioParams, ScenarioResult } from "@/lib/types";
import { Play, Save, RotateCcw, GitCompare, X, Check } from "lucide-react";

// ─── Default params ────────────────────────────────────────────────────────────
const DEFAULTS: Required<ScenarioParams> = {
  policy: "base_stock",
  lead_time_days: 7,
  review_period_days: 7,
  service_level: 0.95,
  demand_multiplier: 1.0,
  price_multiplier: 1.0,
  elasticity: 0.0,
  shock_start: null,
  shock_end: null,
  holding_rate: 0.02,
  order_cost: 10,
  stockout_penalty: 2.0,
};

const BASELINE_METRICS = {
  fill_rate: 0.9229, stockout_units: 64150, stockout_day_rate: 0.043,
  avg_on_hand: 21.17, holding_cost: 169800, stockout_cost: 192450, total_cost: 829250,
};

// ─── Slider param row ─────────────────────────────────────────────────────────
function Param({
  label, id, min, max, step,
  fmt, value, onChange, hint,
}: {
  label: string; id: string; min: number; max: number; step: number;
  fmt: (v: number) => string; value: number;
  onChange: (v: number) => void; hint: string;
}) {
  return (
    <div className="param-group">
      <label className="param-label" htmlFor={id}>
        {label}
        <span className="param-value">{fmt(value)}</span>
      </label>
      <input
        id={id} type="range" className="slider"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="param-hint">{hint}</div>
    </div>
  );
}

// ─── Metric comparison row ────────────────────────────────────────────────────
function CompareRow({
  label, baseline, left, right, leftName, rightName, fmt, lowerBetter,
}: {
  label: string; baseline: number; left?: number; right?: number;
  leftName: string; rightName: string;
  fmt: (v: number) => string; lowerBetter: boolean;
}) {
  const deltaLeft  = left  != null ? ((left  - baseline) / baseline) * 100 : null;
  const deltaRight = right != null ? ((right - baseline) / baseline) * 100 : null;

  const winner = (dl: number | null, dr: number | null) => {
    if (dl == null || dr == null) return null;
    const leftBetter  = lowerBetter ? dl < dr  : dl > dr;
    const rightBetter = lowerBetter ? dr < dl  : dr > dl;
    if (leftBetter)  return "left";
    if (rightBetter) return "right";
    return "tie";
  };

  const w = winner(deltaLeft, deltaRight);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr 1fr",
      gap: "var(--sp-4)",
      padding: "var(--sp-3) var(--sp-4)",
      borderBottom: "1px solid var(--divider)",
      alignItems: "center",
      fontSize: "var(--ts-sm)",
    }}>
      <span style={{ color: "var(--tx-tertiary)", fontSize: "var(--ts-xs)" }}>{label}</span>
      {/* Left scenario */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {w === "left" && <Check size={12} color="var(--ok-500)" />}
        <span style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-semibold)", color: w === "left" ? "var(--ok-text)" : "var(--tx-primary)" }}>
          {left != null ? fmt(left) : <span style={{ color: "var(--tx-disabled)" }}>—</span>}
        </span>
        {deltaLeft != null && (
          <span style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-medium)", color: (lowerBetter ? deltaLeft < -0.5 : deltaLeft > 0.5) ? "var(--ok-text)" : (lowerBetter ? deltaLeft > 0.5 : deltaLeft < -0.5) ? "var(--dn-text)" : "var(--tx-tertiary)" }}>
            {deltaLeft > 0 ? "+" : ""}{deltaLeft.toFixed(1)}%
          </span>
        )}
      </div>
      {/* Right scenario */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {w === "right" && <Check size={12} color="var(--ok-500)" />}
        <span style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-semibold)", color: w === "right" ? "var(--ok-text)" : "var(--tx-primary)" }}>
          {right != null ? fmt(right) : <span style={{ color: "var(--tx-disabled)" }}>—</span>}
        </span>
        {deltaRight != null && (
          <span style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-medium)", color: (lowerBetter ? deltaRight < -0.5 : deltaRight > 0.5) ? "var(--ok-text)" : (lowerBetter ? deltaRight > 0.5 : deltaRight < -0.5) ? "var(--dn-text)" : "var(--tx-tertiary)" }}>
            {deltaRight > 0 ? "+" : ""}{deltaRight.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Saved scenario card ──────────────────────────────────────────────────────
interface Saved { id: string; name: string; result: ScenarioResult }

function ScenarioCard({ s, onRemove }: { s: Saved; onRemove: () => void }) {
  return (
    <div style={{
      padding: "var(--sp-4)", background: "var(--surface)",
      border: "1px solid var(--border)", borderRadius: "var(--r-md)",
      display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--ts-sm)", fontWeight: "var(--fw-semibold)", marginBottom: "var(--sp-1)" }}>{s.name}</div>
        <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
          SL {fmtPct(s.result.params.service_level ?? 0.95)} ·
          Fill {fmtPct(s.result.metrics.fill_rate)} ·
          Cost {fmtCurrency(s.result.metrics.total_cost)} ·
          {s.result.params.policy === "base_stock" ? " Base-Stock" : " Naive"}
        </div>
        {/* Mini bar */}
        <div style={{ marginTop: "var(--sp-2)", display: "flex", gap: "var(--sp-3)" }}>
          {[
            { label: "Fill", val: s.result.metrics.fill_rate, ref: BASELINE_METRICS.fill_rate, pct: true, lowerBetter: false },
            { label: "Cost", val: s.result.metrics.total_cost, ref: BASELINE_METRICS.total_cost, pct: false, lowerBetter: true },
          ].map((m) => {
            const delta = ((m.val - m.ref) / m.ref) * 100;
            const good = m.lowerBetter ? delta < 0 : delta > 0;
            return (
              <div key={m.label} style={{ fontSize: "var(--ts-xs)", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: "var(--tx-tertiary)" }}>{m.label}</span>
                <span style={{ color: good ? "var(--ok-text)" : "var(--dn-text)", fontWeight: "var(--fw-semibold)" }}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} title="Remove">
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScenariosPage() {
  const [paramsA, setParamsA] = useState<Required<ScenarioParams>>(DEFAULTS);
  const [paramsB, setParamsB] = useState<Required<ScenarioParams>>({ ...DEFAULTS, service_level: 0.99, demand_multiplier: 1.3 });
  const [resultA, setResultA] = useState<ScenarioResult | null>(null);
  const [resultB, setResultB] = useState<ScenarioResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [saveCount, setSaveCount] = useState(0);

  const setA = useCallback(<K extends keyof ScenarioParams>(k: K, v: ScenarioParams[K]) => {
    setParamsA((p) => ({ ...p, [k]: v }));
  }, []);
  const setB = useCallback(<K extends keyof ScenarioParams>(k: K, v: ScenarioParams[K]) => {
    setParamsB((p) => ({ ...p, [k]: v }));
  }, []);

  const runA = async () => {
    setLoadingA(true);
    setResultA(await api.runWhatIf(paramsA));
    setLoadingA(false);
  };

  const runB = async () => {
    setLoadingB(true);
    setResultB(await api.runWhatIf(paramsB));
    setLoadingB(false);
  };

  const runBoth = async () => { await Promise.all([runA(), runB()]); };

  const saveResult = (result: ScenarioResult, prefix: string) => {
    const id = `s-${Date.now()}`;
    const n = saveCount + 1;
    setSaveCount(n);
    setSaved((s) => [...s, {
      id, name: `${prefix} — Scenario ${n}`,
      result,
    }]);
  };

  const METRICS = [
    { label: "Fill Rate",         key: "fill_rate",         fmt: (v: number) => fmtPct(v),         lowerBetter: false },
    { label: "Stockout Units",    key: "stockout_units",    fmt: (v: number) => v.toLocaleString(), lowerBetter: true  },
    { label: "Stockout-Day Rate", key: "stockout_day_rate", fmt: (v: number) => fmtPct(v),         lowerBetter: true  },
    { label: "Avg On-Hand",       key: "avg_on_hand",       fmt: (v: number) => v.toFixed(2),       lowerBetter: true  },
    { label: "Holding Cost",      key: "holding_cost",      fmt: (v: number) => fmtCurrency(v),    lowerBetter: true  },
    { label: "Stockout Cost",     key: "stockout_cost",     fmt: (v: number) => fmtCurrency(v),    lowerBetter: true  },
    { label: "Total Cost",        key: "total_cost",        fmt: (v: number) => fmtCurrency(v),    lowerBetter: true  },
  ] as const;

  return (
    <>
      <TopBar
        title="Scenarios"
        subtitle="What-if simulation — deterministic inventory engine, LLM explains results"
        actions={
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <button
              className={`btn btn-sm ${mode === "single" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode("single")}
              id="mode-single"
            >
              Single
            </button>
            <button
              className={`btn btn-sm ${mode === "compare" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode("compare")}
              id="mode-compare"
            >
              <GitCompare size={13} /> Compare A/B
            </button>
          </div>
        }
      />

      <div className="page-body">
        {mode === "single" ? (
          /* ── Single scenario mode ──────────────────────── */
          <div className="scenario-grid">
            {/* Builder */}
            <div>
              <div className="section-hdr" style={{ marginBottom: "var(--sp-5)" }}>
                <div className="section-title">Parameters</div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setParamsA(DEFAULTS); setResultA(null); }}>
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              {/* Policy select */}
              <div className="param-group">
                <div className="param-label" style={{ marginBottom: "var(--sp-2)", display: "block" }}>Policy</div>
                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  {(["base_stock", "naive"] as const).map((p) => (
                    <button
                      key={p}
                      className={`btn btn-sm ${paramsA.policy === p ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setA("policy", p)} id={`policy-a-${p}`}
                    >
                      {p === "base_stock" ? "Base-Stock" : "Naive"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider" />
              <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-4)" }}>Planned</div>
              <Param label="Lead Time"     id="a-lead"    min={1}    max={30}   step={1}     fmt={(v) => `${v} days`}      value={paramsA.lead_time_days}      onChange={(v) => setA("lead_time_days", v)}      hint="Days from order to arrival" />
              <Param label="Review Period" id="a-review"  min={1}    max={14}   step={1}     fmt={(v) => `${v} days`}      value={paramsA.review_period_days}  onChange={(v) => setA("review_period_days", v)}  hint="How often stock is checked" />
              <Param label="Service Level" id="a-sl"      min={0.80} max={0.999} step={0.005} fmt={fmtPct}                 value={paramsA.service_level}       onChange={(v) => setA("service_level", v)}       hint="Target demand coverage probability" />

              <div className="divider" />
              <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-4)" }}>Realized / Shock</div>
              <Param label="Demand Multiplier" id="a-demand" min={0.5} max={2.5} step={0.05} fmt={(v) => `×${v.toFixed(2)}`} value={paramsA.demand_multiplier} onChange={(v) => setA("demand_multiplier", v)} hint="Unanticipated demand change after plan is set" />
              <Param label="Price Multiplier"  id="a-price"  min={0.5} max={2.0} step={0.05} fmt={(v) => `×${v.toFixed(2)}`} value={paramsA.price_multiplier}  onChange={(v) => setA("price_multiplier", v)}  hint="Price change (affects cost; combine with elasticity for demand)" />
              <Param label="Elasticity"        id="a-elas"   min={-3}  max={0}   step={0.1}  fmt={(v) => v.toFixed(1)}        value={paramsA.elasticity}         onChange={(v) => setA("elasticity", v)}         hint="Demand response to price change (0 = none; -2 = 10% price → -20% demand)" />

              <div className="divider" />
              <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-4)" }}>Economics</div>
              <Param label="Holding Rate"       id="a-holding" min={0.005} max={0.1} step={0.005} fmt={fmtPct}            value={paramsA.holding_rate}     onChange={(v) => setA("holding_rate", v)}      hint="Daily holding cost as % of unit value" />
              <Param label="Stockout Penalty"   id="a-penalty" min={0.5}   max={10}  step={0.5}   fmt={(v) => `×${v.toFixed(1)}`} value={paramsA.stockout_penalty} onChange={(v) => setA("stockout_penalty", v)} hint="Lost-sale cost multiplier" />

              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "var(--sp-4)", height: 42, fontSize: "var(--ts-md)" }}
                onClick={runA} disabled={loadingA} id="run-a"
              >
                {loadingA ? <span className="spinner" /> : <Play size={16} />}
                {loadingA ? "Running…" : "Run Simulation"}
              </button>
            </div>

            {/* Results */}
            <div>
              <div className="section-hdr" style={{ marginBottom: "var(--sp-5)" }}>
                <div className="section-title">{resultA ? "Results" : "Configure & Run"}</div>
                {resultA && (
                  <button className="btn btn-secondary btn-sm" onClick={() => saveResult(resultA, "")} id="save-a">
                    <Save size={13} /> Save
                  </button>
                )}
              </div>

              {!resultA ? (
                <div className="empty" style={{ paddingTop: "var(--sp-16)" }}>
                  <div className="empty-icon"><Play size={36} /></div>
                  <div className="empty-title">No results yet</div>
                  <p className="empty-desc">Adjust parameters and run the simulation to see results vs the naive baseline.</p>
                </div>
              ) : (
                <>
                  <div className="metric-strip" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "var(--sp-5)" }}>
                    <div className="metric-cell">
                      <div className="metric-label">Fill Rate</div>
                      <div className={`metric-value ${resultA.metrics.fill_rate >= BASELINE_METRICS.fill_rate ? "success" : "danger"}`}>
                        {fmtPct(resultA.metrics.fill_rate)}
                      </div>
                      <div className="metric-context">Baseline: {fmtPct(BASELINE_METRICS.fill_rate)}</div>
                    </div>
                    <div className="metric-cell">
                      <div className="metric-label">Total Cost</div>
                      <div className="metric-value">{fmtCurrency(resultA.metrics.total_cost)}</div>
                      <div className="metric-context">Baseline: {fmtCurrency(BASELINE_METRICS.total_cost)}</div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="panel-title">vs Naive Baseline</div>
                      <span className="badge badge-copper">{paramsA.policy === "base_stock" ? "Base-Stock" : "Naive"}</span>
                    </div>
                    <div>
                      {METRICS.map((m) => {
                        const base  = BASELINE_METRICS[m.key as keyof typeof BASELINE_METRICS] as number;
                        const res   = resultA.metrics[m.key as keyof typeof resultA.metrics] as number;
                        const delta = ((res - base) / base) * 100;
                        const better = m.lowerBetter ? delta < -0.5 : delta > 0.5;
                        const worse  = m.lowerBetter ? delta > 0.5  : delta < -0.5;
                        return (
                          <div key={m.key} className="result-delta">
                            <span className="result-metric-name">{m.label}</span>
                            <span className="result-baseline">{m.fmt(base)}</span>
                            <span className="result-policy">{m.fmt(res)}</span>
                            <span className={`result-change ${better ? "better" : worse ? "worse" : ""}`}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop: "var(--sp-3)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
                    Deterministic simulation engine · no LLM involved in these numbers.{" "}
                    <a href="/copilot" style={{ color: "var(--cu-500)" }}>Ask copilot to explain →</a>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── A/B compare mode ──────────────────────────── */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)", marginBottom: "var(--sp-8)" }}>
              {/* Scenario A */}
              {(["A", "B"] as const).map((side) => {
                const params  = side === "A" ? paramsA : paramsB;
                const setP    = side === "A" ? setA    : setB;
                const result  = side === "A" ? resultA : resultB;
                const loading = side === "A" ? loadingA : loadingB;
                const run     = side === "A" ? runA    : runB;
                const label   = `Scenario ${side}`;

                return (
                  <div key={side} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{
                      padding: "var(--sp-4) var(--sp-5)",
                      borderBottom: "1px solid var(--border)",
                      background: side === "A" ? "var(--cu-50)" : "var(--surface-raised)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-bold)", fontSize: "var(--ts-lg)", color: side === "A" ? "var(--cu-700)" : "var(--tx-primary)" }}>
                        {label}
                      </div>
                      <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                        {(["base_stock", "naive"] as const).map((p) => (
                          <button
                            key={p}
                            className={`btn btn-sm ${params.policy === p ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setP("policy", p)} id={`policy-${side.toLowerCase()}-${p}`}
                          >
                            {p === "base_stock" ? "Base-Stock" : "Naive"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: "var(--sp-4) var(--sp-5)" }}>
                      <Param label="Service Level"     id={`${side}-sl`}     min={0.80} max={0.999} step={0.005} fmt={fmtPct}                  value={params.service_level}     onChange={(v) => setP("service_level", v)}     hint="Target service level" />
                      <Param label="Lead Time"         id={`${side}-lead`}   min={1}    max={30}    step={1}     fmt={(v) => `${v}d`}           value={params.lead_time_days}    onChange={(v) => setP("lead_time_days", v)}    hint="Days to replenishment" />
                      <Param label="Demand Multiplier" id={`${side}-demand`} min={0.5}  max={2.5}   step={0.05}  fmt={(v) => `×${v.toFixed(2)}`} value={params.demand_multiplier} onChange={(v) => setP("demand_multiplier", v)} hint="Demand shock" />

                      <button
                        className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-3)" }}
                        onClick={run} disabled={loading} id={`run-${side.toLowerCase()}`}
                      >
                        {loading ? <span className="spinner" /> : <Play size={14} />}
                        {loading ? "Running…" : `Run ${label}`}
                      </button>

                      {result && (
                        <div style={{ marginTop: "var(--sp-4)", padding: "var(--sp-4)", background: "var(--surface-raised)", borderRadius: "var(--r-md)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
                            <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fill Rate</span>
                            <span style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-bold)", fontSize: "var(--ts-lg)", color: "var(--ok-text)" }}>{fmtPct(result.metrics.fill_rate)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Cost</span>
                            <span style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-bold)", fontSize: "var(--ts-lg)" }}>{fmtCurrency(result.metrics.total_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Run both */}
            <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-8)", justifyContent: "center" }}>
              <button className="btn btn-primary btn-lg" onClick={runBoth} disabled={loadingA || loadingB} id="run-both">
                {(loadingA || loadingB) ? <span className="spinner" /> : <Play size={16} />}
                Run Both Scenarios
              </button>
              {resultA && resultB && (
                <>
                  <button className="btn btn-secondary" onClick={() => saveResult(resultA, "A")} id="save-compare-a">
                    <Save size={13} /> Save A
                  </button>
                  <button className="btn btn-secondary" onClick={() => saveResult(resultB, "B")} id="save-compare-b">
                    <Save size={13} /> Save B
                  </button>
                </>
              )}
            </div>

            {/* Side-by-side comparison */}
            {(resultA || resultB) && (
              <div>
                <div className="section-hdr">
                  <div className="section-title">Head-to-Head Comparison</div>
                  <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>vs naive baseline · ✓ marks the winner per metric</div>
                </div>
                {/* Header row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "140px 1fr 1fr",
                  gap: "var(--sp-4)", padding: "var(--sp-3) var(--sp-4)",
                  background: "var(--surface-raised)", borderBottom: "1px solid var(--border)",
                  borderRadius: "var(--r-md) var(--r-md) 0 0",
                  fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--tx-tertiary)",
                }}>
                  <span>Metric</span>
                  <span style={{ color: "var(--cu-700)" }}>Scenario A</span>
                  <span>Scenario B</span>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--r-md) var(--r-md)" }}>
                  {METRICS.map((m) => (
                    <CompareRow
                      key={m.key}
                      label={m.label}
                      baseline={BASELINE_METRICS[m.key as keyof typeof BASELINE_METRICS] as number}
                      left={resultA?.metrics[m.key as keyof typeof resultA.metrics] as number | undefined}
                      right={resultB?.metrics[m.key as keyof typeof resultB.metrics] as number | undefined}
                      leftName="Scenario A"
                      rightName="Scenario B"
                      fmt={m.fmt as (v: number) => string}
                      lowerBetter={m.lowerBetter}
                    />
                  ))}
                </div>
                <div style={{ marginTop: "var(--sp-3)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
                  Deltas vs naive baseline ({fmtPct(BASELINE_METRICS.fill_rate)} fill · {fmtCurrency(BASELINE_METRICS.total_cost)} total cost).{" "}
                  <a href="/copilot" style={{ color: "var(--cu-500)" }}>Ask copilot to explain the difference →</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Saved scenarios library ─────────────────── */}
        {saved.length > 0 && (
          <div className="section" style={{ marginTop: "var(--sp-10)" }}>
            <div className="section-hdr">
              <div className="section-title">Saved Scenarios</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSaved([])} id="clear-saved">
                Clear all
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--sp-3)" }}>
              {saved.map((s) => (
                <ScenarioCard key={s.id} s={s} onRemove={() => setSaved((prev) => prev.filter((p) => p.id !== s.id))} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
