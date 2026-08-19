"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { InventoryItem } from "@/lib/types";
import { fmtNumber, fmtCurrency } from "@/lib/utils";
import { X, Package, TrendingUp, Clock, MessageSquare } from "lucide-react";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import { StatusChip } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
}

function categoryOf(itemId: string): string {
  const parts = itemId.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : itemId;
}

function MetricRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-divider py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="num text-sm font-semibold">{value}</span>
        {sub ? <span className="text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
    </div>
  );
}

export function ItemDrawer({ item, onClose }: Props) {
  const { prefill, setContext, resetContext } = useCopilot();
  const handingOff = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  // Ground the copilot on the open item; restore page context on close (unless handing off).
  useEffect(() => {
    if (!item) return;
    setContext({
      item_id: item.item_id,
      store_id: item.store_id,
      series_id: item.unique_id,
      status: item.status,
      current_stock: Math.round(item.current_stock),
      reorder_point: Math.round(item.reorder_point),
      recommended_order_qty: Math.round(item.recommended_order_qty),
      ...(item.days_until_stockout != null ? { days_until_stockout: Math.round(item.days_until_stockout) } : {}),
    });
    return () => {
      if (handingOff.current) { handingOff.current = false; return; }
      resetContext();
    };
  }, [item, setContext, resetContext]);

  if (!item) return null;

  const askCopilot = () => {
    handingOff.current = true;
    // Draft a question into the copilot input (grounded on this item); the user decides to send.
    prefill(`Why is ${item.item_id} at store ${item.store_id} flagged as ${item.status}, and what should I do about it?`);
    onClose();
  };

  const stockPct = Math.min(100, item.order_up_to ? (item.current_stock / item.order_up_to) * 100 : 0);
  const reorderPct = item.order_up_to ? (item.reorder_point / item.order_up_to) * 100 : 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Item detail: ${item.item_id}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-[92vw] flex-col border-l border-border bg-surface shadow-raise animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-5 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-copper-50 text-primary">
            <Package className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="num text-lg font-bold leading-tight">{item.item_id}</div>
            <div className="num mt-0.5 text-xs text-muted-foreground">{item.store_id} · {categoryOf(item.item_id)}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel"><X className="size-4" /></Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5 flex items-center gap-3">
            <StatusChip status={item.status} />
            {item.days_until_stockout != null ? (
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${item.days_until_stockout <= 3 ? "text-danger" : "text-warning"}`}>
                <Clock className="size-3.5" />
                {Math.round(item.days_until_stockout)}d until stockout
              </span>
            ) : null}
          </div>

          {/* Stock bar */}
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Stock level</span>
              <span className="num">{fmtNumber(item.current_stock)} / {fmtNumber(item.order_up_to)} (order-up-to)</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="absolute inset-y-0 z-10 w-0.5 bg-warning" style={{ left: `${reorderPct}%` }} title={`Reorder point: ${fmtNumber(item.reorder_point)}`} />
              <div
                className={`h-full rounded-full ${item.status === "critical" ? "bg-danger" : item.status === "reorder" ? "bg-warning" : item.status === "overstock" ? "bg-info" : "bg-success"}`}
                style={{ width: `${stockPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>0</span>
              <span className="text-warning">▲ reorder ({fmtNumber(item.reorder_point)})</span>
              <span>{fmtNumber(item.order_up_to)}</span>
            </div>
          </div>

          <p className="label-eyebrow mb-1">Inventory position</p>
          <div className="mb-5">
            <MetricRow label="Current stock" value={fmtNumber(item.current_stock)} />
            <MetricRow label="Safety stock" value={fmtNumber(item.safety_stock)} sub="Buffer against demand variability" />
            <MetricRow label="Reorder point" value={fmtNumber(item.reorder_point)} sub="Order when stock falls to this level" />
            <MetricRow label="Order-up-to" value={fmtNumber(item.order_up_to)} sub="Target level after replenishment" />
            <MetricRow label="Recommended order qty" value={<span className="text-primary">{fmtNumber(item.recommended_order_qty)}</span>} sub="Units to order now" />
          </div>

          <p className="label-eyebrow mb-1">Demand &amp; price</p>
          <div className="mb-5">
            <MetricRow label="Mean daily demand" value={item.mean_daily_demand.toFixed(2)} sub="Average units sold per day" />
            <MetricRow label="Unit price" value={item.unit_price != null ? fmtCurrency(item.unit_price) : "-"} />
          </div>

          <p className="label-eyebrow mb-1">Item info</p>
          <div>
            <MetricRow label="Series ID" value={<span className="text-xs">{item.unique_id}</span>} />
            <MetricRow label="Store" value={item.store_id} />
            <MetricRow label="Category" value={categoryOf(item.item_id)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <Button className="flex-1" onClick={askCopilot} id="drawer-ask-copilot">
            <MessageSquare className="size-4" /> Ask Copilot
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/scenarios?item=${item.item_id}&store=${item.store_id}`} id="drawer-run-scenario">
              <TrendingUp className="size-4" /> Run scenario
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
