"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCopilot } from "./CopilotProvider";

/** The page content column. Shifts right to make room when the docked copilot is open. */
export default function MainRegion({ children }: { children: ReactNode }) {
  const { open } = useCopilot();
  const pathname = usePathname();
  const shifted = open && pathname !== "/copilot";
  return <div className={`app-main ${shifted ? "copilot-open" : ""}`}>{children}</div>;
}
