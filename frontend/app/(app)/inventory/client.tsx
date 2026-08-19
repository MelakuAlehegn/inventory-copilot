"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { InventoryItem, InventorySummary, InventoryStatus } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { fmtNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/app/top-bar";
import { Kpi, KpiStrip, Panel, StatusChip, fmt } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemDrawer } from "@/components/inventory/ItemDrawer";

const PAGE_SIZES = [25, 50, 100, 200];

const TABS: { key: InventoryStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "reorder", label: "Reorder" },
  { key: "healthy", label: "Healthy" },
  { key: "overstock", label: "Overstock" },
];

export default function InventoryClient() {
  const searchParams = useSearchParams();
  const initStatus = (searchParams.get("status") as InventoryStatus | null) ?? "";
  const { data: session } = useSession();
  const token = session?.backendToken;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storeOpts, setStoreOpts] = useState<string[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InventoryStatus | "">(initStatus);
  const [store, setStore] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    if (!token) return;
    const api = apiClient(token);
    api.getInventorySummary().then(setSummary).catch(() => setSummary(null));
    api.getStores().then((s) => setStoreOpts(s.map((x) => x.store_id).sort())).catch(() => setStoreOpts([]));
  }, [token]);

  useEffect(() => { setPage(0); }, [status, store, search, pageSize]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const rows = await apiClient(token).getInventory({
        status: status || undefined,
        store: store || undefined,
        search: search || undefined,
        limit: pageSize + 1,
        offset: page * pageSize,
      });
      setHasNext(rows.length > pageSize);
      setItems(rows.slice(0, pageSize));
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, store, search, token, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  const counts = {
    total: summary?.total ?? 0,
    critical: summary?.critical ?? 0,
    reorder: summary?.reorder ?? 0,
    healthy: summary?.healthy ?? 0,
    overstock: summary?.overstock ?? 0,
  };
  const viewTotal = !store && !search ? (status ? counts[status] : counts.total) : undefined;
  const rangeStart = items.length ? page * pageSize + 1 : 0;
  const rangeEnd = page * pageSize + items.length;

  return (
    <>
      <TopBar
        title="Inventory"
        subtitle="Base-stock policy · reorder point, safety stock and recommended orders"
        actions={
          <Button size="sm" onClick={() => load()} className="gap-1.5" id="inv-run-policy">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      />

      <div className="space-y-5 p-6">
        <KpiStrip>
          <Kpi label="Critical" value={fmt(counts.critical)} tone="danger" hint="Stockout imminent" />
          <Kpi label="Reorder soon" value={fmt(counts.reorder)} tone="warning" hint="At or below reorder point" />
          <Kpi label="Healthy" value={fmt(counts.healthy)} tone="success" hint="Within policy band" />
          <Kpi label="Overstock" value={fmt(counts.overstock)} hint="Above order-up-to" />
        </KpiStrip>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-1 rounded-md bg-surface-2 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key || "all"}
                  onClick={() => setStatus(t.key)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    status === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                  id={`inv-tab-${t.key || "all"}`}
                >
                  {t.label}
                  {t.key ? <span className={cn("num ml-1.5 text-[10px]", status === t.key ? "text-primary-foreground/75" : "text-muted-foreground")}>{fmt(counts[t.key])}</span> : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item id" className="num h-8 w-[190px] pl-8 text-xs" id="inv-search" />
              </div>
              <Select value={store || "all"} onValueChange={(v) => setStore(v === "all" ? "" : v)}>
                <SelectTrigger className="num h-8 w-[112px] text-xs" id="inv-store-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All stores</SelectItem>
                  {storeOpts.map((s) => <SelectItem key={s} value={s} className="num text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="num h-8 w-[74px] text-xs" id="inv-page-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)} className="num text-xs">{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <p className="text-sm font-medium">Couldn&apos;t load inventory</p>
              <p className="text-xs text-muted-foreground">The backend could not be reached. Use Refresh to retry.</p>
            </div>
          ) : !loading && items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted-foreground"><Package className="size-5" /></span>
              <p className="text-sm font-medium">No items match these filters</p>
              <p className="max-w-sm text-xs text-muted-foreground">Clear the search term or pick another store.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Item", "Store", "Stock", "Reorder pt.", "Safety", "Order up to", "Rec. order", "Mean/day", "Days left", "Status"].map((h, i) => (
                      <th key={h} className={`label-eyebrow whitespace-nowrap px-4 py-2.5 ${i > 1 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-2.5"><div className="skeleton h-3.5 w-4/5 rounded" /></td>
                          ))}
                        </tr>
                      ))
                    : items.map((r) => (
                        <tr key={r.unique_id} onClick={() => setSelected(r)} className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2" id={`inv-row-${r.unique_id}`}>
                          <td className="num px-4 py-2.5 text-[13px]">{r.item_id}</td>
                          <td className="num px-4 py-2.5 text-[13px] text-muted-foreground">{r.store_id}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] font-medium">{fmtNumber(r.current_stock)}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] text-muted-foreground">{fmtNumber(r.reorder_point)}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] text-muted-foreground">{fmtNumber(r.safety_stock)}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] text-muted-foreground">{fmtNumber(r.order_up_to)}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] font-semibold text-primary">{r.recommended_order_qty ? fmtNumber(r.recommended_order_qty) : "-"}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px] text-muted-foreground">{r.mean_daily_demand.toFixed(1)}</td>
                          <td className="num px-4 py-2.5 text-right text-[13px]">{r.days_until_stockout != null ? `${Math.round(r.days_until_stockout)}d` : "-"}</td>
                          <td className="px-4 py-2.5 text-right"><StatusChip status={r.status} /></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              Showing <span className="num text-foreground">{fmt(rangeStart)}</span>–<span className="num text-foreground">{fmt(rangeEnd)}</span>
              {viewTotal != null ? <> of <span className="num">{fmt(viewTotal)}</span></> : null} · click a row for detail
            </span>
            <span className="flex items-center gap-3">
              <span>Page {page + 1}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} id="inv-prev">
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasNext || loading} id="inv-next">
                Next <ChevronRight className="size-4" />
              </Button>
            </span>
          </div>
        </Panel>
      </div>

      <ItemDrawer item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
