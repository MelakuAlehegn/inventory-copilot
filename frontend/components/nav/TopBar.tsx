"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Bell, RefreshCw, Sparkles } from "lucide-react";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import ThemeToggle from "./ThemeToggle";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
}

export default function TopBar({ title, subtitle, actions, onRefresh }: Props) {
  const pathname = usePathname();
  const { open, toggle } = useCopilot();
  const showAsk = pathname !== "/copilot";

  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="topbar-page">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>

      <div className="topbar-actions">
        {actions}
        {showAsk && (
          <button
            className={`btn btn-sm ${open ? "btn-primary" : "btn-secondary"}`}
            onClick={toggle}
            title="Ask the copilot about this page"
            id="topbar-ask"
          >
            <Sparkles size={14} /> Ask
          </button>
        )}
        {onRefresh && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onRefresh}
            title="Refresh"
            id="topbar-refresh"
          >
            <RefreshCw size={14} />
          </button>
        )}
        <ThemeToggle />
        <button className="btn btn-ghost btn-icon btn-sm" title="Notifications" id="topbar-notifications">
          <Bell size={14} />
        </button>
      </div>
    </header>
  );
}
