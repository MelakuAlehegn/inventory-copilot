"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  FlaskConical,
  BarChart2,
  MessageSquare,
  LogOut,
  Settings,
} from "lucide-react";

const NAV = [
  {
    section: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/forecast", label: "Forecast", icon: TrendingUp },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/scenarios", label: "Scenarios", icon: FlaskConical },
      { href: "/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    section: "Copilot",
    items: [
      { href: "/copilot", label: "Ask Copilot", icon: MessageSquare },
    ],
  },
];

export default function Sidebar({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="logo-text">
          <div className="logo-name">Inventory Copilot</div>
          <div className="logo-sub">M5 · FOODS · 14k series</div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-nav">
        {NAV.map((group) => (
          <div className="nav-section" key={group.section}>
            <span className="nav-section-label">{group.section}</span>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const badge =
                item.href === "/inventory" && alertCount > 0
                  ? alertCount
                  : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${isActive ? " active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  id={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon size={16} className="nav-icon" />
                  {item.label}
                  {badge ? <span className="nav-badge">{badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <Link href="/settings" className="nav-item" style={{ marginBottom: 4 }}>
          <Settings size={15} className="nav-icon" />
          Settings
        </Link>
        <div
          className="user-tile"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          role="button"
          tabIndex={0}
          id="sidebar-signout"
        >
          <div className="user-avatar">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt={initials} />
            ) : (
              initials
            )}
          </div>
          <div className="user-name truncate" style={{ flex: 1 }}>
            {session?.user?.name ?? session?.user?.email ?? "User"}
          </div>
          <LogOut size={14} style={{ color: "var(--tx-tertiary)", flexShrink: 0 }} />
        </div>
      </div>
    </nav>
  );
}
