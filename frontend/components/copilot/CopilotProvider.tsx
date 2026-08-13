"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type CopilotContextData = Record<string, string | number>;

interface CopilotState {
  open: boolean;
  /** What the copilot is currently grounded on — sent with every message. */
  context: CopilotContextData;
  openPanel: () => void;
  closePanel: () => void;
  toggle: () => void;
  /** Pages call this to enrich the context (e.g. the selected inventory item). */
  setContext: (c: CopilotContextData) => void;
}

const CopilotCtx = createContext<CopilotState | null>(null);

/** Friendly page name from the route, used as the baseline context. */
function pageName(pathname: string): string {
  if (pathname === "/") return "dashboard";
  return pathname.replace(/^\//, "").split("/")[0] || "dashboard";
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [context, setContextState] = useState<CopilotContextData>({ page: pageName(pathname) });

  // Reset to the baseline page context on navigation; pages enrich it afterwards.
  useEffect(() => {
    setContextState({ page: pageName(pathname) });
  }, [pathname]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const setContext = useCallback(
    (c: CopilotContextData) => setContextState((prev) => ({ ...prev, ...c })),
    []
  );

  return (
    <CopilotCtx.Provider value={{ open, context, openPanel, closePanel, toggle, setContext }}>
      {children}
    </CopilotCtx.Provider>
  );
}

export function useCopilot(): CopilotState {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}
