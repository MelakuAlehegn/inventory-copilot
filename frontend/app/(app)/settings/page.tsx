import TopBar from "@/components/nav/TopBar";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Account, API, and preferences" />
      <div className="page-body">
        <div style={{ maxWidth: 600 }}>
          <div className="section">
            <div className="section-hdr"><div className="section-title">Account</div></div>
            <div style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)", padding: "var(--sp-4) 0" }}>
              Manage your OAuth session. Sign out using the button at the bottom of the sidebar.
            </div>
          </div>

          <div className="section">
            <div className="section-hdr"><div className="section-title">Backend Connection</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              <div>
                <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-2)" }}>
                  API URL
                </div>
                <div className="input" style={{ display: "flex", alignItems: "center", background: "var(--surface-raised)", color: "var(--tx-secondary)", cursor: "default", fontFamily: "var(--ff-mono)", fontSize: "var(--ts-xs)" }}>
                  {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
                </div>
                <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", marginTop: "var(--sp-1)" }}>
                  Set via NEXT_PUBLIC_API_URL environment variable.
                </div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-hdr"><div className="section-title">About</div></div>
            <div style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)", lineHeight: "var(--lh-relaxed)" }}>
              <strong style={{ color: "var(--tx-primary)" }}>Inventory Copilot</strong> is a production-grade retail AI system
              built with LightGBM quantile forecasting, base-stock inventory policy,
              deterministic simulation, and a LangGraph agent grounded on real tool outputs.
              <br /><br />
              Backend: FastAPI + LangGraph + Gemini · Frontend: Next.js + Auth.js<br />
              Data: M5 Walmart FOODS · 14,370 series · 28-day horizon
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
