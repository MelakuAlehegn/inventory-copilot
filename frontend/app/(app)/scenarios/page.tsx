"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Play, Save, RotateCcw, GitCompare, X, Check, ChevronDown } from "lucide-react";
import { apiClient } from "@/lib/api";
import { fmtPct, fmtCurrency, cn } from "@/lib/utils";
import type { ScenarioParams, PolicyMetrics, SavedScenario, ParetoPoint } from "@/lib/types";
import { TopBar } from "@/components/app/top-bar";
import { Kpi, Panel, PanelHeader, Delta } from "@/components/app/primitives";
import { Modal } from "@/components/app/modal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { ParetoChartWrapper } from "@/components/charts/ParetoChartWrapper";
import { loadPolicyDefaults } from "@/lib/prefs";

const DEFAULTS: Required<ScenarioParams> = {
  policy: "base_stock",
  lead_time: 7,
  review_period: 7,
  service_level: 0.95,
  demand_multiplier: 1.0,
  price_multiplier: 1.0,
  elasticity: 0.0,
  shock_start: null,
  shock_end: null,
};

const METRICS = [
  { label: "Fill Rate",         key: "fill_rate",         fmt: (v: number) => fmtPct(v),          lowerBetter: false },
  { label: "Stockout Units",    key: "stockout_units",    fmt: (v: number) => v.toLocaleString(), lowerBetter: true  },
  { label: "Stockout-Day Rate", key: "stockout_day_rate", fmt: (v: number) => fmtPct(v),          lowerBetter: true  },
  { label: "Avg On-Hand",       key: "avg_on_hand",       fmt: (v: number) => v.toFixed(2),       lowerBetter: true  },
  { label: "Holding Cost",      key: "holding_cost",      fmt: (v: number) => fmtCurrency(v),     lowerBetter: true  },
  { label: "Stockout Cost",     key: "stockout_cost",     fmt: (v: number) => fmtCurrency(v),     lowerBetter: true  },
  { label: "Total Cost",        key: "total_cost",        fmt: (v: number) => fmtCurrency(v),     lowerBetter: true  },
] as const;

const policyLabel = (p: ScenarioParams["policy"]) => (p === "naive" ? "Naive" : "Base-Stock");

function Control({ label, value, min, max, step, format, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="label-eyebrow">{label}</span>
        <span className="num text-sm font-semibold">{format(value)}</span>
      </div>
      <Slider className="mt-3" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v!)} />
      {hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PolicyToggle({ value, onChange, side }: { value: ScenarioParams["policy"]; onChange: (p: ScenarioParams["policy"]) => void; side: string }) {
  return (
    <div className="flex rounded-md bg-surface-2 p-1">
      {(["base_stock", "naive"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          id={`policy-${side}-${p}`}
          className={cn(
            "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
            value === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          {policyLabel(p)}
        </button>
      ))}
    </div>
  );
}

export default function ScenariosPage() {
  const { data: session } = useSession();
  const token = session?.backendToken;

  const [paramsA, setParamsA] = useState<Required<ScenarioParams>>(DEFAULTS);
  const [paramsB, setParamsB] = useState<Required<ScenarioParams>>({ ...DEFAULTS, service_level: 0.99, demand_multiplier: 1.3 });
  const [resultA, setResultA] = useState<PolicyMetrics | null>(null);
  const [resultB, setResultB] = useState<PolicyMetrics | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [baseline, setBaseline] = useState<PolicyMetrics | null>(null);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [pareto, setPareto] = useState<ParetoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedScenario | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveTarget, setSaveTarget] = useState<Required<ScenarioParams> | null>(null);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    if (!token) return;
    const api = apiClient(token);
    api.comparePolicies({ service_level: DEFAULTS.service_level, lead_time: DEFAULTS.lead_time, review_period: DEFAULTS.review_period })
      .then((r) => setBaseline(r.naive))
      .catch(() => setBaseline(null));
    api.getScenarios().then(setSaved).catch(() => setSaved([]));
    api.getPareto().then(setPareto).catch(() => setPareto([]));
  }, [token]);

  // Seed the builder from the saved policy defaults (Settings) on mount.
  useEffect(() => {
    const d = loadPolicyDefaults();
    setParamsA((p) => ({ ...p, service_level: d.service_level, lead_time: d.lead_time, review_period: d.review_period }));
  }, []);

  const setA = useCallback(<K extends keyof ScenarioParams>(k: K, v: ScenarioParams[K]) => setParamsA((p) => ({ ...p, [k]: v })), []);
  const setB = useCallback(<K extends keyof ScenarioParams>(k: K, v: ScenarioParams[K]) => setParamsB((p) => ({ ...p, [k]: v })), []);

  const runA = async () => {
    if (!token) return;
    setLoadingA(true); setError(null);
    try { setResultA(await apiClient(token).runWhatIf(paramsA)); }
    catch { setError("Couldn't run scenario A."); }
    finally { setLoadingA(false); }
  };
  const runB = async () => {
    if (!token) return;
    setLoadingB(true); setError(null);
    try { setResultB(await apiClient(token).runWhatIf(paramsB)); }
    catch { setError("Couldn't run scenario B."); }
    finally { setLoadingB(false); }
  };
  const runBoth = async () => { await Promise.all([runA(), runB()]); };

  const nameFor = (p: Required<ScenarioParams>) =>
    `${policyLabel(p.policy)} · SL ${fmtPct(p.service_level)} · ×${p.demand_multiplier.toFixed(2)}`;

  // Open the name dialog for a scenario before saving.
  const openSave = (p: Required<ScenarioParams>) => { setSaveTarget(p); setSaveName(nameFor(p)); };

  const commitSave = async () => {
    if (!token || !saveTarget) return;
    const name = saveName.trim() || nameFor(saveTarget);
    setError(null);
    try {
      await apiClient(token).saveScenario(name, saveTarget);
      setSaved(await apiClient(token).getScenarios());
    } catch { setError("Couldn't save scenario."); }
    setSaveTarget(null);
  };

  const saveBoth = async () => {
    if (!token) return;
    setError(null);
    try {
      await apiClient(token).saveScenario(`A · ${nameFor(paramsA)}`, paramsA);
      await apiClient(token).saveScenario(`B · ${nameFor(paramsB)}`, paramsB);
      setSaved(await apiClient(token).getScenarios());
    } catch { setError("Couldn't save scenarios."); }
  };

  // Load a saved scenario into the single-mode builder and run it.
  const loadAndRun = async (s: SavedScenario) => {
    if (!token) return;
    const p = { ...DEFAULTS, ...s.params } as Required<ScenarioParams>;
    setParamsA(p); setMode("single"); setLoadingA(true); setError(null);
    try { setResultA(await apiClient(token).runWhatIf(p)); }
    catch { setError("Couldn't run scenario."); }
    finally { setLoadingA(false); }
  };

  const removeScenario = async (id: string) => {
    if (!token) return;
    try {
      await apiClient(token).deleteScenario(id);
      setSaved((prev) => prev.filter((s) => s.id !== id));
    } catch { setError("Couldn't delete scenario."); }
  };

  const pct = (a: number, b: number | null) => (b ? ((a - b) / b) * 100 : 0);

  const SavedPanel = (
    <Panel>
      <PanelHeader title="Saved scenarios" subtitle="Your saved runs" />
      {saved.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No saved scenarios yet. Run a simulation and hit Save.</p>
      ) : (
        <ul className="divide-y divide-border">
          {saved.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{s.name}</p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {policyLabel(s.params.policy ?? "base_stock")} · SL {fmtPct(s.params.service_level ?? 0.95)} · LT {s.params.lead_time ?? 7}d · ×{(s.params.demand_multiplier ?? 1).toFixed(2)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadAndRun(s)} className="shrink-0" id={`run-saved-${s.id}`}>
                <Play className="size-3.5" /> Run
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPendingDelete(s)} aria-label="Delete" className="shrink-0"><X className="size-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  const ParetoPanel = (
    <Panel>
      <PanelHeader title="Cost vs service level" subtitle={`Pareto frontier · ${policyLabel(paramsA.policy)} across service levels`} />
      {pareto.length ? (
        <ParetoChartWrapper data={pareto} policies={[paramsA.policy]} />
      ) : (
        <p className="px-5 py-16 text-center text-sm text-muted-foreground">Frontier unavailable.</p>
      )}
    </Panel>
  );

  return (
    <>
      <TopBar
        title="Scenarios"
        subtitle="Deterministic what-if simulation · the copilot explains the results"
        actions={
          <div className="flex gap-1 rounded-md bg-surface-2 p-1">
            <button onClick={() => setMode("single")} id="mode-single"
              className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", mode === "single" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground")}>
              Single
            </button>
            <button onClick={() => setMode("compare")} id="mode-compare"
              className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors", mode === "compare" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground")}>
              <GitCompare className="size-3.5" /> Compare A/B
            </button>
          </div>
        }
      />

      <div className="space-y-5 p-6">
        {error ? (
          <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-foreground">{error}</div>
        ) : null}

        {mode === "single" ? (
          <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
            {/* Left column: parameters (top) + saved (bottom) */}
            <div className="space-y-5">
              <Panel>
                <PanelHeader
                  title="Parameters"
                  action={<Button variant="ghost" size="sm" onClick={() => { setParamsA(DEFAULTS); setResultA(null); }}><RotateCcw className="size-3.5" /> Reset</Button>}
                />
                <div className="px-5 py-4">
                  <span className="label-eyebrow">Policy</span>
                  <div className="mt-2"><PolicyToggle value={paramsA.policy} onChange={(p) => setA("policy", p)} side="a" /></div>
                </div>
                <div className="divide-y divide-border border-t border-border">
                  <Control label="Lead time" value={paramsA.lead_time} min={1} max={30} step={1} format={(v) => `${v} days`} onChange={(v) => setA("lead_time", v)} hint="Days from order to arrival" />
                  <Control label="Review period" value={paramsA.review_period} min={1} max={14} step={1} format={(v) => `${v} days`} onChange={(v) => setA("review_period", v)} hint="How often stock is checked" />
                  <Control label="Service level" value={paramsA.service_level} min={0.8} max={0.999} step={0.005} format={fmtPct} onChange={(v) => setA("service_level", v)} hint="Target demand-coverage probability" />
                  <Control label="Demand multiplier" value={paramsA.demand_multiplier} min={0.5} max={2.5} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setA("demand_multiplier", Math.round(v * 100) / 100)} hint="Unanticipated demand change after the plan is set" />
                  {showAdvanced ? (
                    <>
                      <Control label="Price multiplier" value={paramsA.price_multiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setA("price_multiplier", Math.round(v * 100) / 100)} hint="Price change (affects cost; pair with elasticity)" />
                      <Control label="Elasticity" value={paramsA.elasticity} min={-3} max={0} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => setA("elasticity", Math.round(v * 10) / 10)} hint="Demand response to price (0 = none)" />
                    </>
                  ) : null}
                </div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between border-t border-border px-5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>Advanced parameters</span>
                  <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
                </button>
                <div className="border-t border-border p-4">
                  <Button className="w-full" onClick={runA} disabled={loadingA || !token} id="run-a">
                    <Play className="size-4" /> {loadingA ? "Running…" : "Run scenario"}
                  </Button>
                </div>
              </Panel>

              {SavedPanel}
            </div>

            {/* Right column: results (KPIs) + pareto + vs-naive table */}
            <div className="space-y-5">
              {resultA ? (
                <Panel className="grid grid-cols-2 divide-x divide-border">
                  <Kpi label="Fill rate" value={fmtPct(resultA.fill_rate)} tone="success"
                    hint={baseline ? <><Delta value={pct(resultA.fill_rate, baseline.fill_rate)} /> vs naive</> : undefined} />
                  <Kpi label="Total cost" value={fmtCurrency(resultA.total_cost)} tone="primary"
                    hint={baseline ? <><Delta value={pct(resultA.total_cost, baseline.total_cost)} invert /> vs naive</> : undefined} />
                </Panel>
              ) : null}

              {!resultA ? (
                <Panel className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted-foreground"><Play className="size-5" /></span>
                  <p className="text-sm font-medium">No results yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">Adjust the parameters and run the scenario to see results against the naive baseline.</p>
                </Panel>
              ) : (
                <Panel>
                  <PanelHeader title="Scenario vs naive baseline" subtitle="Same parameters, seasonal-naive policy"
                    action={<Button variant="outline" size="sm" onClick={() => openSave(paramsA)} id="save-a"><Save className="size-3.5" /> Save</Button>} />
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        {["Metric", "Naive", "Scenario", "Δ"].map((h, i) => (
                          <th key={h} className={`label-eyebrow px-5 py-2.5 ${i > 0 ? "text-right" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((m) => {
                        const base = baseline ? (baseline[m.key] as number) : null;
                        const res = resultA[m.key] as number;
                        return (
                          <tr key={m.key} className="border-b border-border last:border-0 hover:bg-surface-2">
                            <td className="px-5 py-2.5 text-[13px] text-muted-foreground">{m.label}</td>
                            <td className="num px-5 py-2.5 text-right text-[13px] text-muted-foreground">{base != null ? m.fmt(base) : "-"}</td>
                            <td className="num px-5 py-2.5 text-right text-[13px] font-semibold">{m.fmt(res)}</td>
                            <td className="px-5 py-2.5 text-right">{base != null ? <Delta value={pct(res, base)} invert={m.lowerBetter} /> : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Panel>
              )}

              {/* Pareto at the bottom */}
              {ParetoPanel}
            </div>
          </div>
        ) : (
          /* A/B compare */
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {(["A", "B"] as const).map((side) => {
                const params = side === "A" ? paramsA : paramsB;
                const setP = side === "A" ? setA : setB;
                const result = side === "A" ? resultA : resultB;
                const loading = side === "A" ? loadingA : loadingB;
                const run = side === "A" ? runA : runB;
                return (
                  <Panel key={side}>
                    <div className={cn("border-b border-border px-5 py-3", side === "A" ? "bg-copper-50" : "")}>
                      <span className="font-display text-base font-bold">Scenario {side}</span>
                    </div>
                    <div className="px-5 py-4">
                      <span className="label-eyebrow">Policy</span>
                      <div className="mt-2"><PolicyToggle value={params.policy} onChange={(p) => setP("policy", p)} side={side.toLowerCase()} /></div>
                    </div>
                    <div className="divide-y divide-border border-t border-border">
                      <Control label="Lead time" value={params.lead_time} min={1} max={30} step={1} format={(v) => `${v} days`} onChange={(v) => setP("lead_time", v)} />
                      <Control label="Review period" value={params.review_period} min={1} max={14} step={1} format={(v) => `${v} days`} onChange={(v) => setP("review_period", v)} />
                      <Control label="Service level" value={params.service_level} min={0.8} max={0.999} step={0.005} format={fmtPct} onChange={(v) => setP("service_level", v)} />
                      <Control label="Demand multiplier" value={params.demand_multiplier} min={0.5} max={2.5} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setP("demand_multiplier", Math.round(v * 100) / 100)} />
                      {showAdvanced ? (
                        <>
                          <Control label="Price multiplier" value={params.price_multiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setP("price_multiplier", Math.round(v * 100) / 100)} />
                          <Control label="Elasticity" value={params.elasticity} min={-3} max={0} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => setP("elasticity", Math.round(v * 10) / 10)} />
                        </>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="flex w-full items-center justify-between border-t border-border px-5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span>Advanced parameters</span>
                      <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
                    </button>
                    <div className="border-t border-border p-4">
                      <Button className="w-full" onClick={run} disabled={loading || !token} id={`run-${side.toLowerCase()}`}>
                        <Play className="size-4" /> {loading ? "Running…" : `Run ${side}`}
                      </Button>
                      {result ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-surface-2 p-4">
                          <div>
                            <p className="label-eyebrow">Fill rate</p>
                            <p className="num text-lg font-bold text-success">{fmtPct(result.fill_rate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="label-eyebrow">Total cost</p>
                            <p className="num text-lg font-bold">{fmtCurrency(result.total_cost)}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={runBoth} disabled={loadingA || loadingB || !token} id="run-both">
                <Play className="size-4" /> Run both scenarios
              </Button>
              {resultA && resultB ? (
                <>
                  <Button variant="outline" onClick={() => openSave(paramsA)} id="save-compare-a"><Save className="size-3.5" /> Save A</Button>
                  <Button variant="outline" onClick={() => openSave(paramsB)} id="save-compare-b"><Save className="size-3.5" /> Save B</Button>
                  <Button variant="outline" onClick={saveBoth} id="save-compare-both"><Save className="size-3.5" /> Save both</Button>
                </>
              ) : null}
            </div>

            {resultA || resultB ? (
              <Panel>
                <PanelHeader title="Head-to-head comparison" subtitle={baseline ? `vs naive baseline · ${fmtPct(baseline.fill_rate)} fill · ${fmtCurrency(baseline.total_cost)} cost` : "vs naive baseline"} />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-eyebrow px-5 py-2.5">Metric</th>
                      <th className="label-eyebrow px-5 py-2.5 text-right text-primary">Scenario A</th>
                      <th className="label-eyebrow px-5 py-2.5 text-right">Scenario B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => {
                      const base = baseline ? (baseline[m.key] as number) : null;
                      const a = resultA ? (resultA[m.key] as number) : null;
                      const b = resultB ? (resultB[m.key] as number) : null;
                      const winner = a != null && b != null ? (m.lowerBetter ? (a < b ? "A" : b < a ? "B" : null) : (a > b ? "A" : b > a ? "B" : null)) : null;
                      return (
                        <tr key={m.key} className="border-b border-border last:border-0 hover:bg-surface-2">
                          <td className="px-5 py-2.5 text-[13px] text-muted-foreground">{m.label}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="inline-flex items-center justify-end gap-2">
                              {winner === "A" ? <Check className="size-3.5 text-success" /> : null}
                              <span className="num text-[13px] font-semibold">{a != null ? m.fmt(a) : "-"}</span>
                              {a != null && base != null ? <span className="w-12 text-right"><Delta value={pct(a, base)} invert={m.lowerBetter} /></span> : null}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="inline-flex items-center justify-end gap-2">
                              {winner === "B" ? <Check className="size-3.5 text-success" /> : null}
                              <span className="num text-[13px] font-semibold">{b != null ? m.fmt(b) : "-"}</span>
                              {b != null && base != null ? <span className="w-12 text-right"><Delta value={pct(b, base)} invert={m.lowerBetter} /></span> : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            ) : null}

            {SavedPanel}
          </div>
        )}
      </div>

      {/* Save with a name */}
      <Modal open={!!saveTarget} onClose={() => setSaveTarget(null)}>
        <h2 className="text-base font-semibold">Save scenario</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Give this scenario a name so you can find it later.</p>
        <Input
          className="mt-4"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Scenario name"
          onKeyDown={(e) => { if (e.key === "Enter") commitSave(); }}
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSaveTarget(null)}>Cancel</Button>
          <Button size="sm" onClick={commitSave} disabled={!saveName.trim()}><Save className="size-3.5" /> Save</Button>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <h2 className="text-base font-semibold">Delete scenario?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          “{pendingDelete?.name}” will be permanently removed. This can&apos;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { const id = pendingDelete?.id; setPendingDelete(null); if (id) removeScenario(id); }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
