"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCopilot } from "./CopilotProvider";
import CopilotChat from "./CopilotChat";
import { Button } from "@/components/ui/button";

const MIN_W = 320;
const MAX_W = 640;
const WIDTH_KEY = "copilot-dock-w";

/**
 * The collapsible left-docked copilot: an in-flow column between the nav rail and the page
 * content, so opening it naturally shifts the data right. Width is drag-resizable (persisted).
 * Hidden on `/copilot`. Renders the real SSE-backed CopilotChat, grounded on the page context.
 */
export default function CopilotDock() {
  const { open, context, pendingPrefill, closePanel } = useCopilot();
  const pathname = usePathname();
  const [width, setWidth] = useState(400);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    if (v >= MIN_W && v <= MAX_W) setWidth(v);
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    if (!drag.current) return;
    const next = Math.min(MAX_W, Math.max(MIN_W, drag.current.startW + (e.clientX - drag.current.startX)));
    setWidth(next);
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
  }, [onMove]);

  // Persist whenever the width settles.
  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* ignore */ }
  }, [width]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    drag.current = { startX: e.clientX, startW: width };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (pathname === "/copilot" || !open) return null;

  return (
    <aside style={{ width }} className="relative flex shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Copilot</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Grounded on <span className="num">{String(context.item_id ?? context.page)}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={closePanel} aria-label="Close copilot">
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CopilotChat variant="panel" context={context} pendingPrefill={pendingPrefill} />
      </div>

      {/* Drag handle on the right edge */}
      <div
        onMouseDown={startDrag}
        className="absolute inset-y-0 -right-1 w-2 cursor-col-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize copilot panel"
      />
    </aside>
  );
}
