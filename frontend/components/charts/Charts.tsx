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
  ReferenceLine,
} from "recharts";
import type { ParetoPoint, ForecastPoint } from "@/lib/types";
import { useChartTokens, type ChartTokens } from "./useChartTokens";

interface Props {
  data: ParetoPoint[];
  height?: number;
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

export function ParetoChart({ data, height = 280 }: Props) {
  const t = useChartTokens();
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
            label={{ value: "Fill Rate (%)", position: "insideBottom", offset: -4, fontSize: 11, fill: t.tick }}
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
            width={48}
            label={{ value: "Cost ($k)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: t.tick }}
          />
          <Tooltip content={<ParetoTooltip tokens={t} />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value}
          />
          <Scatter
            name="base_stock"
            data={basePoints}
            fill={t.basestock}
            line={{ stroke: t.basestock, strokeWidth: 2 }}
            lineType="fitting"
            shape="circle"
          />
          <Scatter
            name="naive"
            data={naivePoints}
            fill={t.naive}
            line={{ stroke: t.naive, strokeWidth: 2, strokeDasharray: "4 4" }}
            lineType="fitting"
            shape="diamond"
          />
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

export function ForecastChart({ data, height = 300 }: ForecastChartProps) {
  const t = useChartTokens();
  const cutoff = data.findIndex((d) => d.actual == null);
  const cutoffDate = cutoff >= 0 ? data[cutoff]?.ds : undefined;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="4 4" />
          <XAxis
            dataKey="ds"
            tick={{ fontSize: 10, fill: t.tick, fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 11, fill: t.tick, fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ForecastTooltip tokens={t} />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          {cutoffDate && (
            <ReferenceLine
              x={cutoffDate}
              stroke={t.cutoff}
              strokeDasharray="3 3"
              label={{ value: "Forecast →", position: "top", fontSize: 10, fill: t.tick }}
            />
          )}
          {/* Quantile bands as lines */}
          <Line dataKey="q99" name="q99" stroke={t.q99} strokeWidth={1} dot={false} strokeDasharray="3 3" />
          <Line dataKey="q95" name="q95" stroke={t.q95} strokeWidth={1} dot={false} strokeDasharray="3 3" />
          <Line dataKey="q90" name="q90" stroke={t.q90} strokeWidth={1.5} dot={false} />
          <Line dataKey="q50" name="q50 (median)" stroke={t.q50} strokeWidth={2} dot={false} />
          <Line dataKey="actual" name="Actual" stroke={t.actual} strokeWidth={2} dot={{ r: 2, fill: t.actual }} connectNulls={false} />
        </LineChart>
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
