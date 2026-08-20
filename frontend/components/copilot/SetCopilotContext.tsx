"use client";

import { useEffect } from "react";
import { useCopilot, type CopilotContextData } from "./CopilotProvider";

/**
 * Enriches the copilot's grounding context for the page that renders it (e.g. the forecast
 * series or the current scenario params). Renders nothing.
 *
 * The write is deferred to a macrotask so it lands AFTER the provider's on-navigation reset
 * (an ancestor effect that would otherwise clobber a same-commit page write). On unmount it
 * restores the plain page context.
 */
export function SetCopilotContext({ context }: { context: CopilotContextData }) {
  const { setContext, resetContext } = useCopilot();
  const key = JSON.stringify(context);

  useEffect(() => {
    const t = setTimeout(() => setContext(context), 0);
    return () => { clearTimeout(t); resetContext(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
