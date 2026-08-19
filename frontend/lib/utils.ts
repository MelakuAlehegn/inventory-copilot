import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

export function fmtPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function fmtCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function fmtDelta(value: number, pct = false): string {
  const sign = value > 0 ? "+" : "";
  return pct ? `${sign}${(value * 100).toFixed(1)}%` : `${sign}${fmt(value)}`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: "Healthy",
    reorder: "Reorder Soon",
    critical: "Critical",
    overstock: "Overstock",
  };
  return map[status] ?? status;
}
