"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

/** Light/dark toggle. The no-flash script in the root layout has already set data-theme;
 * this just flips it and remembers the choice in localStorage. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const syncTheme = () => {
      const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
      setTheme(current);
    };

    syncTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName === "data-theme") {
          syncTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const flip = () => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  return (
    <button
      className="btn btn-ghost btn-icon btn-sm"
      onClick={flip}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      id="theme-toggle"
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
