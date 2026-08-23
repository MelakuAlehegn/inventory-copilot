"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { GLOSSARY, type Term } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * A small "?" info marker that reveals a plain-English explanation on hover or keyboard focus.
 * The popover is portaled to <body> and fixed-positioned so it is never clipped by a table's
 * scroll container or a panel's overflow.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  return (
    <span className={cn("inline-flex items-center align-middle", className)}>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        className="text-muted-foreground/70 transition-colors hover:text-foreground focus:text-foreground focus:outline-none"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Info className="size-3.5" />
      </button>
      {pos && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                top: pos.top - 8,
                left: pos.left,
                transform: "translate(-50%, -100%)",
              }}
              className="pointer-events-none z-100 w-56 rounded-md border border-border bg-surface px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-foreground shadow-md"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/**
 * A term label with its glossary explanation attached. Pass `children` to override the visible
 * text (e.g. an abbreviated table header) while keeping the term's definition.
 */
export function TermLabel({
  term,
  children,
  className,
}: {
  term: Term;
  children?: ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY[term];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children ?? entry.label}
      <InfoTip text={entry.tip} />
    </span>
  );
}
