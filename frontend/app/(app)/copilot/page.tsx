"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/nav/TopBar";
import CopilotChat from "@/components/copilot/CopilotChat";
import { Plus } from "lucide-react";

function CopilotInner() {
  const searchParams = useSearchParams();
  const initQ = searchParams.get("q") ?? "";
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <TopBar
        title="Copilot"
        subtitle="Grounded agent — every number traces to a real tool output"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setResetKey((k) => k + 1)} id="copilot-new-chat">
            <Plus size={14} /> New Chat
          </button>
        }
      />
      <CopilotChat variant="full" initialQuery={initQ || undefined} resetKey={resetKey} />
    </>
  );
}

export default function CopilotPage() {
  return (
    <Suspense>
      <CopilotInner />
    </Suspense>
  );
}
