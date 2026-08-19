"use client";

import { ParetoChart } from "@/components/charts/Charts";
import type { ParetoPoint } from "@/lib/types";

export function ParetoChartWrapper({ data, policies }: { data: ParetoPoint[]; policies?: ("base_stock" | "naive")[] }) {
  return <ParetoChart data={data} height={300} policies={policies} />;
}
