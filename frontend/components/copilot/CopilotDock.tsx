"use client";

import { usePathname } from "next/navigation";
import { useCopilot } from "./CopilotProvider";
import CopilotChat from "./CopilotChat";
import { X, Cpu } from "lucide-react";

/**
 * The collapsible left-docked copilot: slides in between the nav rail and the page data, so
 * you can read the data and ask about it at the same time. Hidden on `/copilot`, which is
 * already the full copilot workspace. Kept mounted so the conversation survives open/close.
 */
export default function CopilotDock() {
  const { open, context, pendingAsk, closePanel } = useCopilot();
  const pathname = usePathname();
  if (pathname === "/copilot") return null;

  return (
    <aside className={`copilot-dock ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="copilot-dock-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <div style={{ width: 24, height: 24, borderRadius: "var(--r-sm)", background: "var(--cu-500)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Cpu size={13} color="#fff" />
          </div>
          <span style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-sm)", fontWeight: "var(--fw-semibold)" }}>Copilot</span>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={closePanel} title="Close" id="copilot-dock-close">
          <X size={14} />
        </button>
      </div>
      <div className="copilot-dock-ctx">
        Grounded on <span className="mono">{String(context.item_id ?? context.page)}</span>
      </div>
      <CopilotChat variant="panel" context={context} pendingAsk={pendingAsk} />
    </aside>
  );
}
