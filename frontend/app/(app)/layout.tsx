import { SessionProvider } from "next-auth/react";
import Sidebar from "@/components/nav/Sidebar";

const DEV_SESSION = {
  user: { name: "Dev User", email: "dev@localhost", image: null },
  expires: "2099-01-01",
  backendToken: "dev-token",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={DEV_SESSION}>
      <div className="app-shell">
        <Sidebar alertCount={12} />
        <div className="app-main">{children}</div>
      </div>
    </SessionProvider>
  );
}
