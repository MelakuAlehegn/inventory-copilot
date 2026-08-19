import Link from "next/link";
import { AlertTriangle, ArrowRight, Package, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { fmtPct, fmtNumber, fmtCurrency } from "@/lib/utils";
import { TopBar } from "@/components/app/top-bar";
import { Delta, Kpi, KpiStrip, Panel, PanelHeader, StatusChip, fmt } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const api = apiClient(session?.backendToken);

  let data;
  try {
    const [scorecard, compare, summary, critical] = await Promise.all([
      api.getScorecard(),
      api.comparePolicies(),
      api.getInventorySummary(),
      api.getInventory({ status: "critical", limit: 10 }),
    ]);
    data = { scorecard, compare, summary, critical };
  } catch {
    return (
      <>
        <TopBar title="Dashboard" subtitle="M5 Walmart FOODS" />
        <div className="p-6">
          <Panel className="flex flex-col items-center gap-2 px-6 py-20 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load data</p>
            <p className="text-xs text-muted-foreground">The backend could not be reached. Please try again.</p>
          </Panel>
        </div>
      </>
    );
  }

  const { scorecard, compare, summary, critical } = data;
  const fc = scorecard.forecast;
  const dc = scorecard.decision;
  const atRisk = summary.critical + summary.reorder;
  const pct = (model: number, naive: number) => (naive ? ((model - naive) / naive) * 100 : 0);

  const policyRows = [
    { metric: "Fill Rate", naive: fmtPct(compare.naive.fill_rate), model: fmtPct(compare.base_stock.fill_rate), delta: pct(compare.base_stock.fill_rate, compare.naive.fill_rate), better: "up" as const },
    { metric: "Stockout Units", naive: fmtNumber(compare.naive.stockout_units), model: fmtNumber(compare.base_stock.stockout_units), delta: pct(compare.base_stock.stockout_units, compare.naive.stockout_units), better: "down" as const },
    { metric: "Stockout-Day Rate", naive: fmtPct(compare.naive.stockout_day_rate), model: fmtPct(compare.base_stock.stockout_day_rate), delta: pct(compare.base_stock.stockout_day_rate, compare.naive.stockout_day_rate), better: "down" as const },
    { metric: "Avg On-Hand", naive: compare.naive.avg_on_hand.toFixed(1), model: compare.base_stock.avg_on_hand.toFixed(1), delta: pct(compare.base_stock.avg_on_hand, compare.naive.avg_on_hand), better: "down" as const },
    { metric: "Total Cost", naive: fmtCurrency(compare.naive.total_cost), model: fmtCurrency(compare.base_stock.total_cost), delta: pct(compare.base_stock.total_cost, compare.naive.total_cost), better: "down" as const },
  ];

  const headline = [
    { icon: TrendingUp, label: "WRMSSE improvement", value: `+${(fc.wrmsse_improvement * 100).toFixed(1)}%`, note: "Model vs seasonal-naive" },
    { icon: Package, label: "Stockout reduction", value: `−${(dc.stockout_units_reduction * 100).toFixed(1)}%`, note: "Forecast vs naive policy" },
    { icon: AlertTriangle, label: "Cost reduction", value: `−${(dc.total_cost_reduction * 100).toFixed(1)}%`, note: "Total simulated cost" },
  ];

  return (
    <>
      <TopBar title="Dashboard" subtitle={`M5 Walmart FOODS · ${fmtNumber(fc.n_series)} series · 28-day horizon`} />

      <div className="space-y-5 p-6">
        {summary.critical > 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <AlertTriangle className="size-4 text-danger" />
              <p>
                <span className="num font-semibold">{fmt(summary.critical)}</span> items critical — stockout imminent. Review the reorder queue.
              </p>
            </div>
            <Button asChild size="sm" variant="destructive">
              <Link href="/inventory?status=critical">View critical</Link>
            </Button>
          </div>
        ) : null}

        <KpiStrip>
          <Kpi label="Total series" value={fmt(fc.n_series)} hint="10 stores · 3 FOODS depts" />
          <Kpi label="Service level" value={fmtPct(dc.service_level)} hint="Target coverage probability" />
          <Kpi label="Forecast accuracy gain" value={`+${(fc.wrmsse_improvement * 100).toFixed(1)}%`} tone="primary" hint="vs seasonal-naive WRMSSE" />
          <Kpi
            label="Mean fill rate"
            value={fmtPct(dc.fill_rate_model)}
            tone="success"
            hint={<><Delta value={pct(dc.fill_rate_model, dc.fill_rate_naive)} /> vs naive baseline</>}
          />
        </KpiStrip>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel>
            <PanelHeader
              title="Reorder queue"
              subtitle={`${fmt(atRisk)} items need attention`}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/inventory" className="gap-1">All inventory <ArrowRight className="size-3.5" /></Link>
                </Button>
              }
            />
            {critical.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No critical items — inventory is healthy.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Item", "Store", "Stock", "Reorder pt.", "Days left", "Status"].map((h, i) => (
                      <th key={h} className={`label-eyebrow px-5 py-2.5 ${i > 1 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {critical.map((row) => (
                    <tr key={row.unique_id} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="num px-5 py-2.5 text-[13px]">{row.item_id}</td>
                      <td className="num px-5 py-2.5 text-[13px] text-muted-foreground">{row.store_id}</td>
                      <td className="num px-5 py-2.5 text-right text-[13px]">{fmtNumber(row.current_stock)}</td>
                      <td className="num px-5 py-2.5 text-right text-[13px] text-muted-foreground">{fmtNumber(row.reorder_point)}</td>
                      <td className="num px-5 py-2.5 text-right text-[13px] font-medium">
                        {row.days_until_stockout != null ? `${Math.round(row.days_until_stockout)}d` : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <StatusChip status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <div className="space-y-5">
            <Panel>
              <PanelHeader
                title="Base-stock vs naive"
                subtitle={`${fmtPct(dc.service_level)} service level · ${fmtNumber(fc.n_series)} series`}
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/scenarios" className="gap-1">What-if <ArrowRight className="size-3.5" /></Link>
                  </Button>
                }
              />
              <ul className="divide-y divide-border">
                {policyRows.map((row) => (
                  <li key={row.metric} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="text-muted-foreground">{row.metric}</span>
                    <span className="flex items-center gap-3">
                      <span className="num text-xs text-muted-foreground">{row.naive}</span>
                      <span className="num font-semibold">{row.model}</span>
                      <span className="w-14 text-right">
                        <Delta value={row.delta} invert={row.better === "down"} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="Headline numbers" subtitle="Model vs seasonal-naive policy" />
              <div className="divide-y divide-border">
                {headline.map((row) => (
                  <div key={row.label} className="flex items-center gap-3 px-5 py-4">
                    <span className="grid size-9 place-items-center rounded-md bg-copper-50 text-primary">
                      <row.icon className="size-4" />
                    </span>
                    <div>
                      <p className="label-eyebrow">{row.label}</p>
                      <p className="num text-xl font-semibold text-primary">{row.value}</p>
                      <p className="text-xs text-muted-foreground">{row.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
