"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; badge?: number };

export function NavRail({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Overview",
      items: [
        { to: "/", label: "Dashboard", icon: LayoutGrid },
        { to: "/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { to: "/forecast", label: "Forecast", icon: TrendingUp },
        { to: "/inventory", label: "Inventory", icon: Boxes, badge: alertCount || undefined },
        { to: "/scenarios", label: "Scenarios", icon: FlaskConical },
      ],
    },
    {
      label: "Copilot",
      items: [{ to: "/copilot", label: "Ask Copilot", icon: MessageSquare }],
    },
  ];

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "?";

  const itemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
      active
        ? "bg-copper-50 font-medium text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Warehouse className="size-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-tight">Inventory Copilot</p>
          <p className="num mt-0.5 text-[10px] tracking-wide text-muted-foreground">M5 · FOODS · 14K SERIES</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="label-eyebrow px-2 pb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link href={item.to} className={itemClass(active)} aria-current={active ? "page" : undefined}>
                      <Icon className="size-4" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="num rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link href="/settings" className={cn(itemClass(pathname === "/settings"), "mb-2")}>
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-semibold text-background">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{session?.user?.name ?? "User"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{session?.user?.email ?? "Signed in"}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
            id="nav-signout"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
