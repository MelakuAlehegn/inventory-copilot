"use client";

import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCopilot } from "./CopilotProvider";
import CopilotChat from "./CopilotChat";
import { Button } from "@/components/ui/button";

/**
 * The collapsible left-docked copilot: an in-flow column between the nav rail and the page
 * content, so opening it naturally shifts the data right. Hidden on `/copilot` (the full
 * workspace). Renders the real SSE-backed CopilotChat, grounded on the current page context.
 */
export default function CopilotDock() {
  const { open, context, pendingAsk, closePanel } = useCopilot();
  const pathname = usePathname();
  if (pathname === "/copilot" || !open) return null;

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-r border-border bg-surface">
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
        <CopilotChat variant="panel" context={context} pendingAsk={pendingAsk} />
      </div>
    </aside>
  );
}
