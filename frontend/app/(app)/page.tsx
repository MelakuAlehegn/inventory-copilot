import Link from "next/link";
import { AlertTriangle, ArrowRight, Package, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { fmtPct, fmtNumber, fmtCurrency } from "@/lib/utils";
import { TopBar } from "@/components/app/top-bar";
import { Delta, Kpi, KpiStrip, Panel, PanelHeader, StatusChip, fmt } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { TermLabel } from "@/components/ui/info-tip";
import type { Term } from "@/lib/glossary";

// Reorder-queue columns; `term` attaches a plain-English tooltip.
const RQ_COLUMNS: { label: string; term?: Term; right?: boolean }[] = [
  { label: "Item" },
  { label: "Store" },
  { label: "Stock", right: true },
  { label: "Reorder level", term: "reorder_level", right: true },
  { label: "Days of stock left", term: "days_of_stock", right: true },
  { label: "Status", right: true },
];

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
        <TopBar title="Dashboard" subtitle="Walmart food sales" />
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

  const policyRows: { metric: string; term?: Term; naive: string; model: string; delta: number; better: "up" | "down" }[] = [
    { metric: "Fill Rate", term: "fill_rate", naive: fmtPct(compare.naive.fill_rate), model: fmtPct(compare.base_stock.fill_rate), delta: pct(compare.base_stock.fill_rate, compare.naive.fill_rate), better: "up" },
    { metric: "Stockout Units", term: "stockout_units", naive: fmtNumber(compare.naive.stockout_units), model: fmtNumber(compare.base_stock.stockout_units), delta: pct(compare.base_stock.stockout_units, compare.naive.stockout_units), better: "down" },
    { metric: "Stockout-Day Rate", term: "stockout_day_rate", naive: fmtPct(compare.naive.stockout_day_rate), model: fmtPct(compare.base_stock.stockout_day_rate), delta: pct(compare.base_stock.stockout_day_rate, compare.naive.stockout_day_rate), better: "down" },
    { metric: "Avg On-Hand", term: "avg_stock_held", naive: compare.naive.avg_on_hand.toFixed(1), model: compare.base_stock.avg_on_hand.toFixed(1), delta: pct(compare.base_stock.avg_on_hand, compare.naive.avg_on_hand), better: "down" },
    { metric: "Total Cost", naive: fmtCurrency(compare.naive.total_cost), model: fmtCurrency(compare.base_stock.total_cost), delta: pct(compare.base_stock.total_cost, compare.naive.total_cost), better: "down" },
  ];

  const headline = [
    { icon: TrendingUp, label: "WRMSSE improvement", value: `+${(fc.wrmsse_improvement * 100).toFixed(1)}%`, note: "Model vs seasonal-naive" },
    { icon: Package, label: "Stockout reduction", value: `−${(dc.stockout_units_reduction * 100).toFixed(1)}%`, note: "Forecast vs naive policy" },
    { icon: AlertTriangle, label: "Cost reduction", value: `−${(dc.total_cost_reduction * 100).toFixed(1)}%`, note: "Total simulated cost" },
  ];

  return (
    <>
      <TopBar title="Dashboard" subtitle={`Walmart food sales · ${fmtNumber(fc.n_series)} product lines · 28-day forecast`} />

      <div className="space-y-5 p-6">
        {summary.critical > 0 ? (
          <div className="flex w-fit items-center gap-3 rounded-lg border border-danger/20 bg-danger-soft/60 px-3.5 py-2 text-[13px]">
            <span className="flex items-center gap-2 text-danger-foreground">
              <AlertTriangle className="size-3.5 shrink-0 text-danger" />
              <span><span className="num font-semibold">{fmt(summary.critical)}</span> items about to run out</span>
            </span>
            <Link href="/inventory?status=critical" className="flex shrink-0 items-center gap-1 text-xs font-medium text-danger transition-opacity hover:opacity-70">
              View <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : null}

        <KpiStrip>
          <Kpi label="Product lines" value={fmt(fc.n_series)} hint="10 stores · 3 food departments" />
          <Kpi label={<TermLabel term="service_level">Service level</TermLabel>} value={fmtPct(dc.service_level)} hint="How often we aim to have enough stock" />
          <Kpi label="Forecast accuracy gain" value={`+${(fc.wrmsse_improvement * 100).toFixed(1)}%`} tone="primary" hint="vs the simple forecast" />
          <Kpi
            label={<TermLabel term="fill_rate">Mean fill rate</TermLabel>}
            value={fmtPct(dc.fill_rate_model)}
            tone="success"
            hint={<><Delta value={pct(dc.fill_rate_model, dc.fill_rate_naive)} /> vs baseline</>}
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
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No critical items. Inventory is healthy.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {RQ_COLUMNS.map((h) => (
                      <th key={h.label} className={`label-eyebrow px-5 py-2.5 ${h.right ? "text-right" : ""}`}>
                        {h.term ? <TermLabel term={h.term}>{h.label}</TermLabel> : h.label}
                      </th>
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
                        {row.days_until_stockout != null ? `${Math.round(row.days_until_stockout)}d` : "-"}
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
                title={<span className="inline-flex items-center gap-1"><TermLabel term="base_stock">Base-stock</TermLabel> vs <TermLabel term="naive">naive</TermLabel></span>}
                subtitle={`${fmtPct(dc.service_level)} service level · ${fmtNumber(fc.n_series)} product lines`}
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/scenarios" className="gap-1">What-if <ArrowRight className="size-3.5" /></Link>
                  </Button>
                }
              />
              <ul className="divide-y divide-border">
                {policyRows.map((row) => (
                  <li key={row.metric} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {row.term ? <TermLabel term={row.term}>{row.metric}</TermLabel> : row.metric}
                    </span>
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
