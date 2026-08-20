"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutGrid,
  BarChart3,
  TrendingUp,
  Boxes,
  FlaskConical,
  MessageSquare,
  Settings,
  LogOut,
  Warehouse,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadDisplayName } from "@/lib/prefs";
import { Modal } from "@/components/app/modal";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; badge?: number };
const COLLAPSE_KEY = "nav-collapsed";

export function NavRail({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setDisplayName(loadDisplayName());
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Overview", items: [
      { to: "/", label: "Dashboard", icon: LayoutGrid },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ] },
    { label: "Intelligence", items: [
      { to: "/forecast", label: "Forecast", icon: TrendingUp },
      { to: "/inventory", label: "Inventory", icon: Boxes, badge: alertCount || undefined },
      { to: "/scenarios", label: "Scenarios", icon: FlaskConical },
    ] },
    { label: "Copilot", items: [{ to: "/copilot", label: "Ask Copilot", icon: MessageSquare }] },
  ];

  const shownName = displayName || session?.user?.name || "User";
  const initials = shownName !== "User"
    ? shownName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "?";

  const itemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
      collapsed && "justify-center gap-0 px-0",
      active ? "bg-copper-50 font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  const collapseBtn = (
    <button
      onClick={toggleCollapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand" : "Collapse"}
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <PanelLeft className="size-4" />
    </button>
  );

  const avatar = (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-semibold text-background">
      {session?.user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.user.image} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-border bg-surface transition-[width]", collapsed ? "w-16" : "w-56")}>
      {/* Logo */}
      <div className={cn("flex items-center border-b border-border py-4", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Warehouse className="size-[18px]" />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold leading-tight">Inventory Copilot</p>
            <p className="num mt-0.5 text-[10px] tracking-wide text-muted-foreground">M5 · FOODS · 14K SERIES</p>
          </div>
        ) : null}
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}>
        {/* Collapsed: a centered toggle at the top (no section labels to sit beside). */}
        {collapsed ? <div className="mb-4 flex justify-center">{collapseBtn}</div> : null}
        {groups.map((group, gi) => (
          <div key={group.label} className="mb-6">
            {!collapsed ? (
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="label-eyebrow">{group.label}</p>
                {gi === 0 ? collapseBtn : null}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link href={item.to} className={cn(itemClass(active), collapsed && "relative")} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>
                      <Icon className="size-4" />
                      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                      {item.badge ? (
                        collapsed ? (
                          <span className="absolute right-1.5 top-1 size-1.5 rounded-full bg-danger" />
                        ) : (
                          <span className="num rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>
                        )
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        <Link href="/settings" className={cn(itemClass(pathname === "/settings"), "mb-2")} title={collapsed ? "Settings" : undefined}>
          <Settings className="size-4" />
          {!collapsed ? "Settings" : null}
        </Link>
        <div className={cn("flex items-center rounded-md transition-colors", collapsed ? "flex-col gap-1" : "gap-1 pr-1 hover:bg-secondary")}>
          <Link
            href="/settings"
            className={cn("flex items-center rounded-md", collapsed ? "p-1" : "min-w-0 flex-1 gap-2.5 px-2 py-2")}
            id="nav-user"
            aria-label="Open settings"
            title={collapsed ? shownName : undefined}
          >
            {avatar}
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{shownName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{session?.user?.email ?? "Signed in"}</span>
              </span>
            ) : null}
          </Link>
          <button
            onClick={() => setConfirmSignOut(true)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
            id="nav-signout"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* Sign-out confirmation */}
      <Modal open={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
        <h2 className="text-base font-semibold">Sign out?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">You&apos;ll need to sign in again to get back in.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</Button>
        </div>
      </Modal>
    </aside>
  );
}
