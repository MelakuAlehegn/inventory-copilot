"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import TopBar from "@/components/nav/TopBar";
import { apiClient } from "@/lib/api";
import { fmtNumber, statusLabel } from "@/lib/utils";
import type { InventoryItem } from "@/lib/types";
import { ItemDrawer } from "@/components/inventory/ItemDrawer";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";

type SortKey =
  | "item_id"
  | "store_id"
  | "current_stock"
  | "reorder_point"
  | "safety_stock"
  | "order_up_to"
  | "mean_daily_demand"
  | "days_until_stockout";
type SortDir = "asc" | "desc";

// Display-only category derived from the M5 item id prefix (FOODS_1_001 -> FOODS_1).
function categoryOf(itemId: string): string {
  const parts = itemId.split("_");
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : itemId;
}

export default function InventoryClient() {
  const searchParams = useSearchParams();
  const initStatus = searchParams.get("status") ?? "";
  const { data: session } = useSession();
  const token = session?.backendToken;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storeOpts, setStoreOpts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initStatus);
  const [store, setStore] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("item_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const data = await apiClient(token).getInventory({
        status: status || undefined,
        store: store || undefined,
        search: search || undefined,
        limit: 5000,
      });
      setItems(data);
      // Capture the full store list when no store filter is applied.
      if (!store) {
        setStoreOpts([...new Set(data.map((i) => i.store_id))].sort());
      }
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, store, search, token]);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const counts = {
    total: items.length,
    critical: items.filter((i) => i.status === "critical").length,
    reorder: items.filter((i) => i.status === "reorder").length,
    healthy: items.filter((i) => i.status === "healthy").length,
    overstock: items.filter((i) => i.status === "overstock").length,
  };

  return (
    <>
      <TopBar
        title="Inventory"
        subtitle={`${counts.total} items · ${counts.critical} critical · ${counts.reorder} reorder soon`}
        onRefresh={load}
        actions={
          <button className="btn btn-primary btn-sm" id="inv-run-policy">
            <SlidersHorizontal size={13} />
            Run Policy Update
          </button>
        }
      />

      <div className="page-body">
        {/* Status tabs */}
        <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-5)", flexWrap: "wrap" }}>
          {[
            { key: "",          label: "All",       count: counts.total    },
            { key: "critical",  label: "Critical",  count: counts.critical },
            { key: "reorder",   label: "Reorder",   count: counts.reorder  },
            { key: "healthy",   label: "Healthy",   count: counts.healthy  },
            { key: "overstock", label: "Overstock", count: counts.overstock},
          ].map((tab) => (
            <button
              key={tab.key}
              className={`btn btn-sm ${status === tab.key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatus(tab.key)}
              id={`inv-tab-${tab.key || "all"}`}
            >
              {tab.label}
              <span style={{
                background: status === tab.key ? "rgba(255,255,255,0.25)" : "var(--canvas)",
                color: status === tab.key ? "#fff" : "var(--tx-tertiary)",
                padding: "0 5px", borderRadius: "var(--r-full)",
                fontSize: "var(--ts-2xs)", fontWeight: "var(--fw-bold)",
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + filters row */}
        <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-5)", alignItems: "center" }}>
          <div className="input-group" style={{ maxWidth: 320 }}>
            <div className="input-icon"><Search size={14} /></div>
            <input
              className="input"
              placeholder="Search item ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="inv-search"
            />
          </div>
          <select
            className="select"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            style={{ width: 140 }}
            id="inv-store-filter"
          >
            <option value="">All stores</option>
            {storeOpts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ marginLeft: "auto", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
            {sorted.length} items · click a row to view detail
          </span>
        </div>

        {error && (
          <div className="empty" style={{ marginBottom: "var(--sp-5)" }}>
            <div className="empty-title">Couldn&apos;t load inventory.</div>
            <p className="empty-desc">The backend could not be reached. Use refresh to retry.</p>
          </div>
        )}

        {/* Table */}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("item_id")}>
                  Item <ArrowUpDown size={11} style={{ display: "inline", verticalAlign: "middle", opacity: 0.5 }} />
                </th>
                <th className="sortable" onClick={() => toggleSort("store_id")}>Store</th>
                <th>Category</th>
                <th className="text-right sortable" onClick={() => toggleSort("current_stock")}>Stock</th>
                <th className="text-right sortable" onClick={() => toggleSort("reorder_point")}>Reorder Pt.</th>
                <th className="text-right sortable" onClick={() => toggleSort("safety_stock")}>Safety</th>
                <th className="text-right sortable" onClick={() => toggleSort("order_up_to")}>Order-Up-To</th>
                <th className="text-right sortable" onClick={() => toggleSort("days_until_stockout")}>Days Left</th>
                <th className="text-right sortable" onClick={() => toggleSort("mean_daily_demand")}>Mean Daily</th>
                <th className="text-right">Unit Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: "80%", borderRadius: 3 }} /></td>
                      ))}
                    </tr>
                  ))
                : sorted.map((item) => (
                    <tr
                      key={item.unique_id}
                      onClick={() => setSelected(item)}
                      style={{ cursor: "pointer" }}
                      id={`inv-row-${item.unique_id}`}
                    >
                      <td>
                        <div style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--ts-sm)" }}>{item.item_id}</div>
                      </td>
                      <td style={{ color: "var(--tx-secondary)" }}>{item.store_id}</td>
                      <td><span className="badge badge-neutral">{categoryOf(item.item_id)}</span></td>
                      <td className="text-right mono" style={{ fontWeight: "var(--fw-medium)" }}>
                        {fmtNumber(item.current_stock)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>
                        {fmtNumber(item.reorder_point)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>
                        {fmtNumber(item.safety_stock)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-tertiary)" }}>
                        {fmtNumber(item.order_up_to)}
                      </td>
                      <td className="text-right">
                        {item.days_until_stockout != null ? (
                          <span style={{
                            fontWeight: "var(--fw-semibold)",
                            color: item.days_until_stockout <= 3 ? "var(--dn-text)"
                                 : item.days_until_stockout <= 7 ? "var(--wn-text)"
                                 : "var(--tx-primary)",
                          }}>
                            {Math.round(item.days_until_stockout)}d
                          </span>
                        ) : <span style={{ color: "var(--tx-disabled)" }}>—</span>}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                        {item.mean_daily_demand.toFixed(1)}
                      </td>
                      <td className="text-right mono" style={{ color: "var(--tx-secondary)" }}>
                        {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : "—"}
                      </td>
                      <td>
                        <span className={`badge badge-${
                          item.status === "critical"  ? "danger"  :
                          item.status === "reorder"   ? "warning" :
                          item.status === "overstock" ? "info"    : "ok"
                        }`}>
                          {item.status === "critical" && <span className="dot dot-danger" />}
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && !error && sorted.length === 0 && (
            <div className="empty">
              <div className="empty-title">No items found</div>
              <p className="empty-desc">Adjust the filters above to see inventory items.</p>
            </div>
          )}
        </div>
      </div>

      {/* Item drilldown drawer */}
      <ItemDrawer item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
