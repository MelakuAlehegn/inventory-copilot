import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import Sidebar from "@/components/nav/Sidebar";
import { CopilotProvider } from "@/components/copilot/CopilotProvider";
import CopilotDock from "@/components/copilot/CopilotDock";
import MainRegion from "@/components/copilot/MainRegion";

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
        <div className="app-shell">
          <Sidebar alertCount={alertCount} />
          <CopilotDock />
          <MainRegion>{children}</MainRegion>
        </div>
      </CopilotProvider>
    </SessionProvider>
  );
}
