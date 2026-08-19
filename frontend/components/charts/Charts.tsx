"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  LineChart,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import type { ParetoPoint, ForecastPoint } from "@/lib/types";
import { useChartTokens, type ChartTokens } from "./useChartTokens";

interface Props {
  data: ParetoPoint[];
  height?: number;
  /** Which policy curves to draw. Defaults to both; pass one to declutter the chart. */
  policies?: ("base_stock" | "naive")[];
}

const LABELS = {
  base_stock: "Base-Stock (Forecast)",
  naive:      "Naive Baseline",
};

function ParetoTooltip({ active, payload, tokens }: { active?: boolean; payload?: Array<{ payload: ParetoPoint }>; tokens: ChartTokens }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 6,
      padding: "10px 14px",
      fontSize: "0.8125rem",
      boxShadow: "0 4px 14px rgba(24,22,15,0.09)",
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 6, color: d.policy === "base_stock" ? tokens.basestock : tokens.naive }}>
        {LABELS[d.policy as keyof typeof LABELS]}
      </div>
      <div style={{ color: tokens.textSecondary, display: "flex", flexDirection: "column", gap: 3 }}>
        <div>Service target: <strong className="mono">{(d.service_level * 100).toFixed(0)}%</strong></div>
        <div>Fill rate: <strong className="mono" style={{ color: tokens.actual }}>{(d.fill_rate * 100).toFixed(1)}%</strong></div>
        <div>Combined cost: <strong className="mono">${(d.combined_cost / 1000).toFixed(1)}k</strong></div>
      </div>
    </div>
  );
}

export function ParetoChart({ data, height = 280, policies = ["base_stock", "naive"] }: Props) {
  const t = useChartTokens();
  const showBase = policies.includes("base_stock");
  const showNaive = policies.includes("naive");
  const base  = data.filter((d) => d.policy === "base_stock");
  const naive = data.filter((d) => d.policy === "naive");

  // Transform: x = fill_rate, y = combined_cost / 1000
  const basePoints  = base.map((d)  => ({ x: parseFloat((d.fill_rate * 100).toFixed(2)), y: parseFloat((d.combined_cost / 1000).toFixed(1)), ...d }));
  const naivePoints = naive.map((d) => ({ x: parseFloat((d.fill_rate * 100).toFixed(2)), y: parseFloat((d.combined_cost / 1000).toFixed(1)), ...d }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="4 4" />
          <XAxis
            type="number"
            dataKey="x"
            name="Fill Rate"
            unit="%"
            domain={["dataMin - 0.5", "dataMax + 0.5"]}
            tick={{ fontSize: 11, fill: t.tick, fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Combined Cost"
            unit="k"
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fontSize: 11, fill: t.tick, fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={<ParetoTooltip tokens={t} />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value}
          />
          {showBase ? (
            <Scatter
              name="base_stock"
              data={basePoints}
              fill={t.basestock}
              line={{ stroke: t.basestock, strokeWidth: 2 }}
              lineType="fitting"
              shape="circle"
            />
          ) : null}
          {showNaive ? (
            <Scatter
              name="naive"
              data={naivePoints}
              fill={t.naive}
              line={{ stroke: t.naive, strokeWidth: 2, strokeDasharray: "4 4" }}
              lineType="fitting"
              shape="diamond"
            />
          ) : null}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Forecast Timeline Chart ───────────────────────────────────────────────────
interface ForecastChartProps {
  data: ForecastPoint[];
  height?: number;
}

function ForecastTooltip({ active, payload, label, tokens }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; tokens: ChartTokens }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 6,
      padding: "10px 14px", fontSize: "0.8125rem",
      boxShadow: "0 4px 14px rgba(24,22,15,0.09)",
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 6, fontSize: "0.75rem", color: tokens.tick }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color ?? tokens.textSecondary, marginBottom: 2 }}>
          <span style={{ fontSize: "0.75rem" }}>{p.name}</span>
          <strong className="mono">{p.value?.toFixed(1) ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}

export function ForecastChart({ data, height = 340 }: ForecastChartProps) {
  const t = useChartTokens();
  const cutoff = data.findIndex((d) => d.actual == null);
  const cutoffDate = cutoff >= 0 ? data[cutoff]?.ds : undefined;
  const tick = { fontSize: 10, fill: t.tick, fontFamily: "var(--font-mono)" };

  // Uncertainty fan: fill each quantile from the baseline, lightest (q99) behind darkest (q80).
  const bands = [
    { key: "q99", fill: t.q99, opacity: 0.55 },
    { key: "q95", fill: t.q95, opacity: 0.55 },
    { key: "q90", fill: t.q90, opacity: 0.5 },
    { key: "q80", fill: t.q50, opacity: 0.15 },
  ];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="ds" tick={tick} tickLine={false} axisLine={{ stroke: t.axis }} minTickGap={28} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ForecastTooltip tokens={t} />} />
          {bands.map((b) => (
            <Area key={b.key} type="monotone" dataKey={b.key} stroke="none" fill={b.fill} fillOpacity={b.opacity} isAnimationActive={false} />
          ))}
          <Line type="monotone" dataKey="q50" stroke={t.q50} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="actual" stroke={t.actual} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          {cutoffDate && (
            <ReferenceLine x={cutoffDate} stroke={t.tick} strokeDasharray="4 4" label={{ value: "forecast start", position: "insideTopRight", fontSize: 10, fill: t.tick }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── KPI Sparkline ─────────────────────────────────────────────────────────────
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color, height = 36, width = 80 }: SparklineProps) {
  const t = useChartTokens();
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line dataKey="v" stroke={color ?? t.basestock} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
