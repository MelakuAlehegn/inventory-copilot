"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { TopBar } from "@/components/app/top-bar";
import { Panel, PanelHeader } from "@/components/app/primitives";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadPolicyDefaults, savePolicyDefaults, DEFAULT_POLICY, loadDisplayName, saveDisplayName, type PolicyDefaults } from "@/lib/prefs";

type Theme = "light" | "dark";
type Health = "checking" | "online" | "offline";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function Row({ label, hint, control }: { label: string; hint: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [theme, setTheme] = useState<Theme>("light");
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [overstock, setOverstock] = useState(false);

  // Editable policy defaults (persisted locally; seed the scenario builder).
  const [policy, setPolicy] = useState<PolicyDefaults>(DEFAULT_POLICY);
  const [savedTick, setSavedTick] = useState(false);

  // Display name (persisted locally; shown in the nav rail).
  const [displayName, setDisplayName] = useState("");
  const [nameTick, setNameTick] = useState(false);

  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as Theme) || "light");
    setPolicy(loadPolicyDefaults());
    setDisplayName(loadDisplayName());
  }, []);

  const saveName = () => {
    saveDisplayName(displayName.trim());
    setNameTick(true);
    setTimeout(() => setNameTick(false), 1600);
  };

  useEffect(() => {
    let alive = true;
    fetch(`${API}/health`, { cache: "no-store" })
      .then((r) => { if (alive) setHealth(r.ok ? "online" : "offline"); })
      .catch(() => { if (alive) setHealth("offline"); });
    return () => { alive = false; };
  }, []);

  const setThemeTo = (dark: boolean) => {
    const next: Theme = dark ? "dark" : "light";
    const el = document.documentElement;
    el.setAttribute("data-theme", next);
    el.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  const savePolicy = () => {
    savePolicyDefaults(policy);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  };

  const healthChip = {
    checking: { cls: "border-border bg-surface-2 text-muted-foreground", dot: "bg-muted-foreground", label: "Checking" },
    online: { cls: "border-success/25 bg-success-soft text-success-foreground", dot: "bg-success", label: "Online" },
    offline: { cls: "border-danger/25 bg-danger-soft text-danger-foreground", dot: "bg-danger", label: "Offline" },
  }[health];

  return (
    <>
      <TopBar title="Settings" subtitle={`Workspace preferences${session?.user?.name ? ` · ${session.user.name}` : ""}`} />

      <div className="max-w-3xl space-y-5 p-6">
        <Panel>
          <PanelHeader
            title="Profile"
            subtitle="How you appear in the app"
            action={
              <Button size="sm" variant="outline" onClick={saveName}>
                {nameTick ? <><Check className="size-3.5 text-success" /> Saved</> : "Save"}
              </Button>
            }
          />
          <div className="divide-y divide-border">
            <Row
              label="Display name"
              hint="Shown in the nav rail; stored on this device"
              control={
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={session?.user?.name ?? "Your name"}
                  className="h-8 w-56 text-sm"
                />
              }
            />
            <Row label="Email" hint="From your sign-in" control={<span className="num text-sm">{session?.user?.email ?? "-"}</span>} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Appearance" subtitle="Light and dark are both first-class" />
          <div className="divide-y divide-border">
            <Row
              label="Dark theme"
              hint="Warm neutral dark surface tuned for long analyst sessions"
              control={<Switch checked={theme === "dark"} onCheckedChange={setThemeTo} />}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Policy defaults"
            subtitle="Seed values for a new scenario"
            action={
              <Button size="sm" variant="outline" onClick={savePolicy}>
                {savedTick ? <><Check className="size-3.5 text-success" /> Saved</> : "Save defaults"}
              </Button>
            }
          />
          <div className="divide-y divide-border">
            <Row
              label="Service level"
              hint="Default target coverage probability (%)"
              control={
                <Input
                  type="number" min={80} max={99.9} step={0.5}
                  value={(policy.service_level * 100).toFixed(1)}
                  onChange={(e) => setPolicy((p) => ({ ...p, service_level: Math.min(0.999, Math.max(0.5, Number(e.target.value) / 100)) }))}
                  className="num h-8 w-24 text-right text-sm"
                />
              }
            />
            <Row
              label="Lead time"
              hint="Days from order placement to receipt"
              control={
                <Input
                  type="number" min={1} max={30} step={1}
                  value={policy.lead_time}
                  onChange={(e) => setPolicy((p) => ({ ...p, lead_time: Math.min(30, Math.max(1, Math.round(Number(e.target.value)))) }))}
                  className="num h-8 w-24 text-right text-sm"
                />
              }
            />
            <Row
              label="Review period"
              hint="Cadence of the base-stock review (days)"
              control={
                <Input
                  type="number" min={1} max={14} step={1}
                  value={policy.review_period}
                  onChange={(e) => setPolicy((p) => ({ ...p, review_period: Math.min(14, Math.max(1, Math.round(Number(e.target.value)))) }))}
                  className="num h-8 w-24 text-right text-sm"
                />
              }
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Alerts" subtitle="When the reorder queue notifies you" />
          <div className="divide-y divide-border">
            <Row label="Critical stockouts" hint="Notify when days-of-cover drops below 3" control={<Switch checked={criticalAlerts} onCheckedChange={setCriticalAlerts} />} />
            <Row label="Weekly digest" hint="Monday summary of fill rate and cost movement" control={<Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />} />
            <Row label="Overstock warnings" hint="Flag items above order-up-to +15%" control={<Switch checked={overstock} onCheckedChange={setOverstock} />} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Backend health" subtitle="Live status of the API this app talks to" />
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-2.5">
              <span className="num text-xs">{API}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${healthChip.cls}`}>
                <span className={`size-1.5 rounded-full ${healthChip.dot}`} /> {healthChip.label}
              </span>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="About" subtitle="Inventory Copilot v1.0" />
          <div className="px-5 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              A retail decision-intelligence system: quantile demand forecasting, base-stock safety-stock
              optimization, deterministic inventory simulation, and a grounded AI copilot that only reports
              numbers computed from real tool outputs.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
