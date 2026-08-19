import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { InventoryStatus as Status } from "@/lib/types";

export function Panel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "default" | "primary" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
  }[tone];
  return (
    <div className="flex flex-col gap-2 px-5 py-5">
      <span className="label-eyebrow">{label}</span>
      <span className={cn("num text-[30px] font-semibold leading-none", toneClass)}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <Panel className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 [&>*:not(:first-child)]:sm:border-l [&>*:not(:first-child)]:sm:border-border">
      {children}
    </Panel>
  );
}

const statusStyles: Record<Status, string> = {
  critical: "bg-danger-soft text-danger-foreground border-danger/25",
  reorder: "bg-warning-soft text-warning-foreground border-warning/25",
  healthy: "bg-success-soft text-success-foreground border-success/25",
  overstock: "bg-info-soft text-info-foreground border-info/25",
};

const statusDot: Record<Status, string> = {
  critical: "bg-danger",
  reorder: "bg-warning",
  healthy: "bg-success",
  overstock: "bg-info",
};

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        statusStyles[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {status}
    </span>
  );
}

export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("num text-xs font-medium", value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-danger")}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("num", className)}>{children}</span>;
}

export function fmt(n: number, digits = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function money(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
