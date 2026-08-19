"use client";

import { useEffect, useState } from "react";

/**
 * Chart colors resolved from the CSS design tokens (tokens.css). Recharts needs literal color
 * strings for SVG, so we read each token via a probe element - getComputedStyle resolves it to
 * an rgb() string (recharts can't always paint raw oklch()). Re-reads on theme change, so charts
 * follow light/dark automatically.
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

// Light-theme fallbacks (used for SSR / first paint before the probe runs).
const DEFAULTS: ChartTokens = {
  basestock: "#A85820",
  naive: "#9A9184",
  actual: "#2A6B47",
  q50: "#A85820",
  q90: "#D29464",
  q95: "#E5BF99",
  q99: "#F4E2CC",
  grid: "#E2DDD5",
  axis: "#E2DDD5",
  tick: "#9A9184",
  cutoff: "#C5BFB4",
  surface: "#FFFFFF",
  border: "#E2DDD5",
  textSecondary: "#5A5347",
};

// Which CSS custom property backs each chart color.
const VARS: Record<keyof ChartTokens, string> = {
  basestock: "--primary",
  naive: "--muted-foreground",
  actual: "--success",
  q50: "--copper-500",
  q90: "--copper-300",
  q95: "--copper-200",
  q99: "--copper-100",
  grid: "--border",
  axis: "--border",
  tick: "--muted-foreground",
  cutoff: "--muted-foreground",
  surface: "--surface",
  border: "--border",
  textSecondary: "--muted-foreground",
};

function readTokens(): ChartTokens {
  if (typeof window === "undefined") return DEFAULTS;
  // A hidden probe lets the browser resolve `var(--token)` (often oklch) down to rgb().
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolve = (cssVar: string, fallback: string) => {
    probe.style.color = "";
    probe.style.color = `var(${cssVar})`;
    const rgb = getComputedStyle(probe).color;
    return rgb || fallback;
  };
  const out = {} as ChartTokens;
  (Object.keys(VARS) as (keyof ChartTokens)[]).forEach((k) => {
    out[k] = resolve(VARS[k], DEFAULTS[k]);
  });
  probe.remove();
  return out;
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(DEFAULTS);

  useEffect(() => {
    const update = () => setTokens(readTokens());
    update();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);

  return tokens;
}
