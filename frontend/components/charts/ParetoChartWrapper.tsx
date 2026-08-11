"use client";

import { ParetoChart } from "@/components/charts/Charts";
import type { ParetoPoint } from "@/lib/types";

export function ParetoChartWrapper({ data }: { data: ParetoPoint[] }) {
  return <ParetoChart data={data} height={300} />;
}
