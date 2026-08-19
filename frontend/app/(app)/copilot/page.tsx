"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/app/top-bar";
import { Button } from "@/components/ui/button";
import CopilotChat from "@/components/copilot/CopilotChat";

function CopilotInner() {
  const searchParams = useSearchParams();
  const initQ = searchParams.get("q") ?? "";
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <TopBar
        title="Copilot"
        subtitle="Grounded answers · every number produced by a verified tool call"
        actions={
          <Button variant="outline" size="sm" onClick={() => setResetKey((k) => k + 1)} id="copilot-new-chat">
            <Plus className="size-4" /> New chat
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <CopilotChat variant="full" initialQuery={initQ || undefined} resetKey={resetKey} />
      </div>
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
