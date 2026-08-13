"use client";

import { useEffect } from "react";
import type { InventoryItem } from "@/lib/types";
import { fmtNumber, fmtCurrency, statusLabel } from "@/lib/utils";
import { X, Package, TrendingUp, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import Link from "next/link";

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
}

// Display-only category derived from the M5 item id prefix (FOODS_1_001 -> FOODS_1).
function categoryOf(itemId: string): string {
  const parts = itemId.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : itemId;
}

function MetricRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "var(--sp-3) 0", borderBottom: "1px solid var(--divider)",
    }}>
      <span style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)" }}>{label}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
        <span style={{ fontFamily: "var(--ff-display)", fontWeight: "var(--fw-semibold)", fontSize: "var(--ts-sm)", textAlign: "right" }}>
          {value}
        </span>
        {sub && <span style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>{sub}</span>}
      </span>
    </div>
  );
}

export function ItemDrawer({ item, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  if (!item) return null;

  const statusConfig = {
    critical:  { cls: "badge-danger",  dot: "dot-danger",  icon: AlertTriangle },
    reorder:   { cls: "badge-warning", dot: "dot-warning", icon: AlertTriangle },
    healthy:   { cls: "badge-ok",      dot: "dot-ok",      icon: Package       },
    overstock: { cls: "badge-info",    dot: undefined,     icon: Package       },
  }[item.status] ?? { cls: "badge-neutral", dot: undefined, icon: Package };

  const stockPct = Math.min(100, (item.current_stock / item.order_up_to) * 100);
  const reorderPct = (item.reorder_point / item.order_up_to) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(24,22,15,0.25)",
          zIndex: 300,
          animation: "fadeIn 150ms ease-out",
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Item detail: ${item.item_id}`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 420,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 400,
          display: "flex", flexDirection: "column",
          boxShadow: "var(--sh-lg)",
          animation: "slideIn 200ms var(--ease-out)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "var(--sp-5) var(--sp-5) var(--sp-4)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: "var(--sp-4)",
        }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            background: "var(--cu-50)", borderRadius: "var(--r-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Package size={18} color="var(--cu-500)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-lg)", fontWeight: "var(--fw-bold)", letterSpacing: "var(--ls-snug)", marginBottom: 2 }}>
              {item.item_id}
            </div>
            <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
              {item.store_id} · {categoryOf(item.item_id)}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close panel"
            id="drawer-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-5)" }}>
          {/* Status + urgency */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
            <span className={`badge ${statusConfig.cls}`} style={{ fontSize: "var(--ts-sm)", padding: "4px 12px" }}>
              {statusConfig.dot && <span className={`dot ${statusConfig.dot}`} />}
              {statusLabel(item.status)}
            </span>
            {item.days_until_stockout != null && (
              <span style={{ fontSize: "var(--ts-sm)", color: item.days_until_stockout <= 3 ? "var(--dn-text)" : "var(--wn-text)", fontWeight: "var(--fw-semibold)" }}>
                <Clock size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                {item.days_until_stockout}d until stockout
              </span>
            )}
          </div>

          {/* Stock level bar */}
          <div style={{ marginBottom: "var(--sp-6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
              <span>Stock level</span>
              <span className="mono">{fmtNumber(item.current_stock)} / {fmtNumber(item.order_up_to)} (order-up-to)</span>
            </div>
            <div style={{ height: 10, background: "var(--canvas)", borderRadius: "var(--r-full)", overflow: "hidden", position: "relative" }}>
              {/* Reorder point marker */}
              <div style={{
                position: "absolute", left: `${reorderPct}%`, top: 0, bottom: 0, width: 2,
                background: "var(--wn-500)", zIndex: 2,
              }} title={`Reorder point: ${fmtNumber(item.reorder_point)}`} />
              {/* Stock bar */}
              <div style={{
                width: `${stockPct}%`, height: "100%",
                background: item.status === "critical" ? "var(--dn-500)" : item.status === "reorder" ? "var(--wn-500)" : item.status === "overstock" ? "var(--in-500)" : "var(--ok-500)",
                borderRadius: "var(--r-full)",
                transition: "width 400ms var(--ease-out)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
              <span>0</span>
              <span style={{ color: "var(--wn-text)" }}>▲ reorder ({fmtNumber(item.reorder_point)})</span>
              <span>{fmtNumber(item.order_up_to)}</span>
            </div>
          </div>

          {/* Key metrics */}
          <div style={{ marginBottom: "var(--sp-5)" }}>
            <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-2)" }}>
              Inventory Position
            </div>
            <MetricRow label="Current Stock"  value={<span className="mono">{fmtNumber(item.current_stock)}</span>} />
            <MetricRow label="Safety Stock"   value={<span className="mono">{fmtNumber(item.safety_stock)}</span>} sub="Buffer held against demand variability" />
            <MetricRow label="Reorder Point"  value={<span className="mono">{fmtNumber(item.reorder_point)}</span>} sub="Order when stock falls to this level" />
            <MetricRow label="Order-Up-To"    value={<span className="mono">{fmtNumber(item.order_up_to)}</span>}  sub="Target stock level after replenishment" />
            <MetricRow label="Recommended Order Qty" value={<span className="mono">{fmtNumber(item.recommended_order_qty)}</span>} sub="Units to order now" />
          </div>

          <div style={{ marginBottom: "var(--sp-5)" }}>
            <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-2)" }}>
              Demand &amp; Price
            </div>
            <MetricRow label="Mean Daily Demand" value={<span className="mono">{item.mean_daily_demand.toFixed(2)}</span>} sub="Average units sold per day" />
            <MetricRow label="Unit Price"        value={item.unit_price != null ? fmtCurrency(item.unit_price) : "—"} />
            {item.days_until_stockout != null && (
              <MetricRow label="Days Until Stockout" value={<span className="mono">{Math.round(item.days_until_stockout)}d</span>} sub="At current mean demand" />
            )}
          </div>

          <div>
            <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-2)" }}>
              Item Info
            </div>
            <MetricRow label="Item ID"   value={<span className="mono">{item.item_id}</span>} />
            <MetricRow label="Store"     value={<span className="mono">{item.store_id}</span>} />
            <MetricRow label="Category"  value={<span className="badge badge-neutral">{categoryOf(item.item_id)}</span>} />
            <MetricRow label="Series ID" value={<span className="mono" style={{ fontSize: "var(--ts-xs)" }}>{item.unique_id}</span>} />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "var(--sp-4) var(--sp-5)",
          borderTop: "1px solid var(--border)",
          display: "flex", gap: "var(--sp-3)",
        }}>
          <Link
            href={`/copilot?q=${encodeURIComponent(`What is the recommended reorder strategy for ${item.item_id} in store ${item.store_id}?`)}`}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            id="drawer-ask-copilot"
          >
            <MessageSquare size={14} />
            Ask Copilot
          </Link>
          <Link
            href={`/scenarios?item=${item.item_id}&store=${item.store_id}`}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: "center" }}
            id="drawer-run-scenario"
          >
            <TrendingUp size={14} />
            Run Scenario
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}
