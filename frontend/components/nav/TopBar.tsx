"use client";
import { ReactNode } from "react";
import { Bell, RefreshCw } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
}

export default function TopBar({ title, subtitle, actions, onRefresh }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="topbar-page">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>

      <div className="topbar-actions">
        {actions}
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
        <button className="btn btn-ghost btn-icon btn-sm" title="Notifications" id="topbar-notifications">
          <Bell size={14} />
        </button>
      </div>
    </header>
  );
}
