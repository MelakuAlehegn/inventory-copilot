import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { apiClient } from "@/lib/api";
import Sidebar from "@/components/nav/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Real session (the middleware guarantees the user is authenticated to reach here).
  const session = await auth();

  // Count items needing attention for the sidebar badge; tolerate backend errors.
  let alertCount = 0;
  try {
    const inventory = await apiClient(session?.backendToken).getInventory({ limit: 5000 });
    alertCount = inventory.filter((i) => i.status === "critical" || i.status === "reorder").length;
  } catch {
    alertCount = 0;
  }

  return (
    <SessionProvider session={session}>
      <div className="app-shell">
        <Sidebar alertCount={alertCount} />
        <div className="app-main">{children}</div>
      </div>
    </SessionProvider>
  );
}
