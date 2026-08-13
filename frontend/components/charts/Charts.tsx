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
import type { ParetoPoint } from "@/lib/types";

interface Props {
  data: ParetoPoint[];
  height?: number;
}

const COLORS = {
  base_stock: "#A85820",
  naive:      "#9A9184",
};

const LABELS = {
  base_stock: "Base-Stock (Forecast)",
  naive:      "Naive Baseline",
};

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ParetoPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E2DDD5",
      borderRadius: 6,
      padding: "10px 14px",
      fontSize: "0.8125rem",
      boxShadow: "0 4px 14px rgba(24,22,15,0.09)",
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 6, color: COLORS[d.policy as keyof typeof COLORS] }}>
        {LABELS[d.policy as keyof typeof LABELS]}
      </div>
      <div style={{ color: "#5A5347", display: "flex", flexDirection: "column", gap: 3 }}>
        <div>Service target: <strong>{(d.service_level * 100).toFixed(0)}%</strong></div>
        <div>Fill rate: <strong style={{ color: "#2A6B47" }}>{(d.fill_rate * 100).toFixed(1)}%</strong></div>
        <div>Combined cost: <strong>${(d.combined_cost / 1000).toFixed(1)}k</strong></div>
      </div>
    </div>
  );
}

export function ParetoChart({ data, height = 280 }: Props) {
  const base  = data.filter((d) => d.policy === "base_stock");
  const naive = data.filter((d) => d.policy === "naive");

  // Transform: x = fill_rate, y = combined_cost / 1000
  const basePoints  = base.map((d)  => ({ x: parseFloat((d.fill_rate * 100).toFixed(2)), y: parseFloat((d.combined_cost / 1000).toFixed(1)), ...d }));
  const naivePoints = naive.map((d) => ({ x: parseFloat((d.fill_rate * 100).toFixed(2)), y: parseFloat((d.combined_cost / 1000).toFixed(1)), ...d }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke="#ECEAE4" strokeDasharray="4 4" />
          <XAxis
            type="number"
            dataKey="x"
            name="Fill Rate"
            unit="%"
            domain={["dataMin - 0.5", "dataMax + 0.5"]}
            tick={{ fontSize: 11, fill: "#9A9184", fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={{ stroke: "#E2DDD5" }}
            label={{ value: "Fill Rate (%)", position: "insideBottom", offset: -4, fontSize: 11, fill: "#9A9184" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Combined Cost"
            unit="k"
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fontSize: 11, fill: "#9A9184", fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{ value: "Cost ($k)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#9A9184" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value}
          />
          {/* Lines connecting points */}
          <Scatter
            name="base_stock"
            data={basePoints}
            fill={COLORS.base_stock}
            line={{ stroke: COLORS.base_stock, strokeWidth: 2 }}
            lineType="fitting"
            shape="circle"
          />
          <Scatter
            name="naive"
            data={naivePoints}
            fill={COLORS.naive}
            line={{ stroke: COLORS.naive, strokeWidth: 2, strokeDasharray: "4 4" }}
            lineType="fitting"
            shape="diamond"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Forecast Timeline Chart ───────────────────────────────────────────────────
import type { ForecastPoint } from "@/lib/types";

interface ForecastChartProps {
  data: ForecastPoint[];
  height?: number;
}

function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #E2DDD5", borderRadius: 6,
      padding: "10px 14px", fontSize: "0.8125rem",
      boxShadow: "0 4px 14px rgba(24,22,15,0.09)",
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 6, fontSize: "0.75rem", color: "#9A9184" }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color ?? "#5A5347", marginBottom: 2 }}>
          <span style={{ fontSize: "0.75rem" }}>{p.name}</span>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{p.value?.toFixed(1) ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}

export function ForecastChart({ data, height = 300 }: ForecastChartProps) {
  const cutoff = data.findIndex((d) => d.actual == null);
  const cutoffDate = cutoff >= 0 ? data[cutoff]?.ds : undefined;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke="#ECEAE4" strokeDasharray="4 4" />
          <XAxis
            dataKey="ds"
            tick={{ fontSize: 10, fill: "#9A9184", fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={{ stroke: "#E2DDD5" }}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9A9184", fontFamily: "Inter, sans-serif" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ForecastTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          />
          {cutoffDate && (
            <ReferenceLine
              x={cutoffDate}
              stroke="#C8C3B5"
              strokeDasharray="3 3"
              label={{ value: "Forecast →", position: "top", fontSize: 10, fill: "#9A9184" }}
            />
          )}
          {/* Quantile bands as lines */}
          <Line dataKey="q99" name="q99" stroke="#E5BF99" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          <Line dataKey="q95" name="q95" stroke="#D29464" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          <Line dataKey="q90" name="q90" stroke="#BE7038" strokeWidth={1.5} dot={false} />
          <Line dataKey="q50" name="q50 (median)" stroke="#A85820" strokeWidth={2} dot={false} />
          <Line dataKey="actual" name="Actual" stroke="#2A6B47" strokeWidth={2} dot={{ r: 2, fill: "#2A6B47" }} connectNulls={false} />
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

export function Sparkline({ data, color = "#A85820", height = 36, width = 80 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
