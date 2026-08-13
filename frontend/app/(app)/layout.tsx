import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import Sidebar from "@/components/nav/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Real session (the middleware guarantees the user is authenticated to reach here).
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <div className="app-shell">
        <Sidebar alertCount={12} />
        <div className="app-main">{children}</div>
      </div>
    </SessionProvider>
  );
}
