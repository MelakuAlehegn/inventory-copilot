"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api";
import type { ForecastPoint } from "@/lib/types";
import { Panel, PanelHeader } from "@/components/app/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ForecastChartWrapper } from "@/components/charts/ForecastChartWrapper";
import { SetCopilotContext } from "@/components/copilot/SetCopilotContext";
import { ExportCsvButton } from "@/components/app/export-csv-button";

const quantileGuide = [
  { q: "q50", title: "Median", body: "50% coverage. Minimum viable stock; expect stockouts on busy days." },
  { q: "q80", title: "80th pctile", body: "80% coverage. Moderate buffer for routine variance." },
  { q: "q90", title: "90th pctile", body: "90% coverage. A good starting point for most retail operations." },
  { q: "q95", title: "95th pctile", body: "Default operating point. Balances service level against carrying cost." },
  { q: "q99", title: "99th pctile", body: "Near-guarantee. High stock, near-zero stockouts. Critical items only." },
];

export function ForecastSeriesPanel({
  items, stores, initialItem, initialStore, initialPoints,
}: {
  items: string[];
  stores: string[];
  initialItem: string;
  initialStore: string;
  initialPoints: ForecastPoint[];
}) {
  const { data: session } = useSession();
  const token = session?.backendToken;

  const [item, setItem] = useState(initialItem);
  const [store, setStore] = useState(initialStore);
  const [points, setPoints] = useState<ForecastPoint[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const uid = `${item}_${store}`;

  const loadSeries = async (nextItem: string, nextStore: string) => {
    setItem(nextItem);
    setStore(nextStore);
    if (!token) return;
    setLoading(true);
    setNotFound(false);
    try {
      const s = await apiClient(token).getForecastSeries(`${nextItem}_${nextStore}`);
      setPoints(s.points);
    } catch {
      setPoints([]);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const nActual = points.filter((p) => p.actual != null).length;
  const nForecast = points.length - nActual;

  return (
    <>
      <SetCopilotContext context={{ page: "forecast", series_id: uid, item_id: item, store_id: store }} />

      {/* Series selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="label-eyebrow">Series</span>
        <Select value={item} onValueChange={(v) => loadSeries(v, store)}>
          <SelectTrigger className="num h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {items.map((it) => <SelectItem key={it} value={it} className="num text-xs">{it}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={store} onValueChange={(v) => loadSeries(item, v)}>
          <SelectTrigger className="num h-8 w-[104px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {stores.map((s) => <SelectItem key={s} value={s} className="num text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="num text-xs text-muted-foreground">{uid}</span>
      </div>

      {/* Quantile fan */}
      <Panel>
        <PanelHeader
          title="Quantile fan"
          subtitle={loading ? "Loading…" : `${nActual} days actuals · ${nForecast} days forecast`}
          action={
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-success" /> Actual</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> q50</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-copper-200" /> q80-q99</span>
            </div>
          }
        />
        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : notFound ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">No forecast for this series.</p>
        ) : points.length > 0 ? (
          <ForecastChartWrapper data={points} />
        ) : (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">No forecast series available.</p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelHeader
            title="Raw quantile data"
            subtitle="First 14 days · actuals vs q90 coverage"
            action={<ExportCsvButton filename={`forecast_${uid}`} rows={points.map((p) => ({ ...p }))} />}
          />
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
    </>
  );
}
