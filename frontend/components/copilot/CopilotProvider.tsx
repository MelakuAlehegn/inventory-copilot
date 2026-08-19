"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type CopilotContextData = Record<string, string | number>;

/** Text to drop into the panel's input (with a nonce so the same text can be re-sent). */
export interface PendingPrefill {
  text: string;
  nonce: number;
}

interface CopilotState {
  open: boolean;
  /** What the copilot is currently grounded on, sent with every message. */
  context: CopilotContextData;
  /** The latest prefill request, consumed by the docked chat (fills the input, does not send). */
  pendingPrefill: PendingPrefill | null;
  openPanel: () => void;
  closePanel: () => void;
  toggle: () => void;
  /** Pages call this to enrich the context (e.g. the selected inventory item). */
  setContext: (c: CopilotContextData) => void;
  /** Reset the context back to just the current page. */
  resetContext: () => void;
  /** Open the panel and prefill the input with a suggested question (the user decides to send). */
  prefill: (text: string) => void;
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
  const [pendingPrefill, setPendingPrefill] = useState<PendingPrefill | null>(null);

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
  const resetContext = useCallback(
    () => setContextState({ page: pageName(pathname) }),
    [pathname]
  );
  const prefill = useCallback((text: string) => {
    setOpen(true);
    setPendingPrefill((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  return (
    <CopilotCtx.Provider
      value={{ open, context, pendingPrefill, openPanel, closePanel, toggle, setContext, resetContext, prefill }}
    >
      {children}
    </CopilotCtx.Provider>
  );
}

export function useCopilot(): CopilotState {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}
