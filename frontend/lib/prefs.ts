// Local, per-browser preferences (no backend yet). Policy defaults seed the Scenario builder.

export interface PolicyDefaults {
  service_level: number; // fraction, e.g. 0.95
  lead_time: number;     // days
  review_period: number; // days
}

export const DEFAULT_POLICY: PolicyDefaults = {
  service_level: 0.95,
  lead_time: 7,
  review_period: 7,
};

const KEY = "policy-defaults";

export function loadPolicyDefaults(): PolicyDefaults {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_POLICY;
}

export function savePolicyDefaults(p: PolicyDefaults): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const NAME_KEY = "user-display-name";

export function loadDisplayName(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

export function saveDisplayName(v: string): void {
  try {
    if (v) window.localStorage.setItem(NAME_KEY, v);
    else window.localStorage.removeItem(NAME_KEY);
  } catch { /* ignore */ }
}
