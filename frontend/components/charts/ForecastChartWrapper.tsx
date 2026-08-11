"use client";

import { ForecastChart } from "@/components/charts/Charts";
import type { ForecastPoint } from "@/lib/types";

export function ForecastChartWrapper({ data }: { data: ForecastPoint[] }) {
  return <ForecastChart data={data} height={320} />;
}
