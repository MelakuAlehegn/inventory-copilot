"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StoreMetrics } from "@/lib/types";
import { useChartTokens } from "./useChartTokens";

/** Units-by-store bar chart, colored from the design tokens (theme-reactive). */
export function StoreBarChart({ data }: { data: StoreMetrics[] }) {
  const t = useChartTokens();
  const tick = { fontSize: 10, fill: t.tick, fontFamily: "var(--font-mono)" };
  return (
    <div className="h-[300px] px-3 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="store_id" tick={tick} tickLine={false} axisLine={{ stroke: t.axis }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={54} />
          <Tooltip
            contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-mono)" }}
            cursor={{ fill: "var(--color-surface-2)" }}
          />
          <Bar dataKey="total_units" name="Units" fill={t.basestock} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
