import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import { NavRail } from "@/components/app/nav-rail";
import { CopilotProvider } from "@/components/copilot/CopilotProvider";
import CopilotDock from "@/components/copilot/CopilotDock";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Real session (the middleware guarantees the user is authenticated to reach here).
  const session = await auth();

  // Count items needing attention for the sidebar badge; tolerate backend errors.
  // Uses the lightweight summary (a few numbers) rather than pulling the full table.
  let alertCount = 0;
  try {
    const summary = await apiClient(session?.backendToken).getInventorySummary();
    alertCount = summary.alert_count;
  } catch {
    alertCount = 0;
  }

  return (
    <SessionProvider session={session}>
      <CopilotProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <NavRail alertCount={alertCount} />
          <CopilotDock />
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </CopilotProvider>
    </SessionProvider>
  );
}
