"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import { NotificationBell } from "@/components/app/notification-bell";

type Theme = "light" | "dark";

export function TopBar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const { toggle, open } = useCopilot();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as Theme) || "light");
  }, []);

  const flipTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const el = document.documentElement;
    el.setAttribute("data-theme", next);
    el.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  // No copilot on the full /copilot page (it IS the copilot) or on settings (nothing to ask).
  const showAsk = pathname !== "/copilot" && !pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/50 bg-background px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <NotificationBell />
        <Button variant="outline" size="sm" onClick={flipTheme} aria-label="Toggle theme" className="gap-1.5 rounded-full">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          Theme
        </Button>
        {showAsk ? (
          <Button size="sm" onClick={toggle} aria-pressed={open} className="gap-1.5 rounded-full grad-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
            Ask Copilot
          </Button>
        ) : null}
      </div>
    </header>
  );
}
