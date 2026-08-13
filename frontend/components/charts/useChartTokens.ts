"use client";

import { useEffect, useState } from "react";

/**
 * Chart colors resolved from the CSS design tokens. Recharts needs literal color strings
 * (it renders SVG), so we read the CSS variables at runtime instead of hardcoding hexes.
 * The hook re-reads on theme change (system preference or an explicit data-theme), so charts
 * follow light/dark mode automatically.
 */
export interface ChartTokens {
  basestock: string;
  naive: string;
  actual: string;
  q50: string;
  q90: string;
  q95: string;
  q99: string;
  grid: string;
  axis: string;
  tick: string;
  cutoff: string;
  surface: string;
  border: string;
  textSecondary: string;
}

// Light-theme values, matching globals.css. Used for SSR/first paint and as fallbacks.
const DEFAULTS: ChartTokens = {
  basestock: "#A85820", // --cu-500
  naive: "#9A9184",     // --tx-tertiary
  actual: "#2A6B47",    // --ok-500
  q50: "#A85820",       // --cu-500
  q90: "#BE7038",       // --cu-400
  q95: "#D29464",       // --cu-300
  q99: "#E5BF99",       // --cu-200
  grid: "#ECEAE4",      // --divider
  axis: "#E2DDD5",      // --border
  tick: "#9A9184",      // --tx-tertiary
  cutoff: "#C5BFB4",    // --border-strong
  surface: "#FFFFFF",   // --surface
  border: "#E2DDD5",    // --border
  textSecondary: "#5A5347", // --tx-secondary
};

function readTokens(): ChartTokens {
  if (typeof window === "undefined") return DEFAULTS;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    basestock: v("--cu-500", DEFAULTS.basestock),
    naive: v("--tx-tertiary", DEFAULTS.naive),
    actual: v("--ok-500", DEFAULTS.actual),
    q50: v("--cu-500", DEFAULTS.q50),
    q90: v("--cu-400", DEFAULTS.q90),
    q95: v("--cu-300", DEFAULTS.q95),
    q99: v("--cu-200", DEFAULTS.q99),
    grid: v("--divider", DEFAULTS.grid),
    axis: v("--border", DEFAULTS.axis),
    tick: v("--tx-tertiary", DEFAULTS.tick),
    cutoff: v("--border-strong", DEFAULTS.cutoff),
    surface: v("--surface", DEFAULTS.surface),
    border: v("--border", DEFAULTS.border),
    textSecondary: v("--tx-secondary", DEFAULTS.textSecondary),
  };
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(DEFAULTS);

  useEffect(() => {
    const update = () => setTokens(readTokens());
    update(); // resolve real values once mounted

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    // Re-read when an explicit theme is toggled on the root element.
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);

  return tokens;
}
