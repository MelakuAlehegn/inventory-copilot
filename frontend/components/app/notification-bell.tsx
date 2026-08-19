"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api";
import type { InventoryItem, InventorySummary } from "@/lib/types";
import { Button } from "@/components/ui/button";

/** Top-bar alerts: a live count of items needing attention, with a dropdown of the top
 * critical ones. The menu is portaled to <body> so the blurred/scrolling top bar can't clip it. */
export function NotificationBell() {
  const { data: session } = useSession();
  const token = session?.backendToken;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (!token) return;
    const api = apiClient(token);
    api.getInventorySummary().then(setSummary).catch(() => setSummary(null));
    api.getInventory({ status: "critical", limit: 6 }).then(setItems).catch(() => setItems([]));
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const count = summary ? summary.critical + summary.reorder : 0;

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  };

  return (
    <>
      <Button ref={btnRef} variant="ghost" size="icon" aria-label="Notifications" onClick={toggle} className="relative" id="topbar-notifications">
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
              <div
                style={{ top: pos.top, right: pos.right }}
                className="fixed z-[61] w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-raise animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Alerts</p>
                  {summary ? (
                    <span className="num text-[11px] text-muted-foreground">{summary.critical} critical · {summary.reorder} reorder</span>
                  ) : null}
                </div>

                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">All clear. No items need attention.</p>
                ) : (
                  <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                    {items.map((it) => (
                      <li key={it.unique_id}>
                        <Link href="/inventory?status=critical" onClick={() => setOpen(false)} className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-2">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                          <span className="min-w-0 flex-1">
                            <span className="num block truncate text-[13px] font-medium">{it.item_id} · {it.store_id}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {it.days_until_stockout != null ? `${Math.round(it.days_until_stockout)}d to stockout` : "At or below reorder point"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <Link href="/inventory" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-surface-2">
                  View all inventory
                </Link>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
