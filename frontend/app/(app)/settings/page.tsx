import TopBar from "@/components/nav/TopBar";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Account, API, and system preferences" />
      <div className="page-body">
        <div style={{ maxWidth: 640 }}>
          {/* Account */}
          <div className="section">
            <div className="section-hdr"><div className="section-title">Account &amp; Session</div></div>
            <div className="panel" style={{ padding: "var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "var(--ts-sm)", fontWeight: "var(--fw-semibold)", color: "var(--tx-primary)", marginBottom: 2 }}>
                  Active OAuth Session
                </div>
                <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>
                  Authenticated session. Sign out using the button at the bottom of the sidebar.
                </div>
              </div>
              <span className="badge badge-ok">
                <span className="dot dot-ok" /> Active
              </span>
            </div>
          </div>

          {/* Connection */}
          <div className="section">
            <div className="section-hdr"><div className="section-title">Backend Connection</div></div>
            <div className="panel" style={{ padding: "var(--sp-5)" }}>
              <div style={{ fontSize: "var(--ts-2xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-2)" }}>
                API Endpoint URL
              </div>
              <div className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-sunken)", color: "var(--tx-primary)", fontFamily: "var(--ff-mono)", fontSize: "var(--ts-xs)", padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)" }}>
                <span>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</span>
                <span className="badge badge-ok" style={{ fontSize: 10 }}>Connected</span>
              </div>
              <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", marginTop: "var(--sp-2)" }}>
                Configured via <code className="mono">NEXT_PUBLIC_API_URL</code> environment variable.
              </div>
            </div>
          </div>

          {/* About */}
          <div className="section">
            <div className="section-hdr"><div className="section-title">System Information</div></div>
            <div className="panel" style={{ padding: "var(--sp-5)" }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-md)", fontWeight: "var(--fw-bold)", color: "var(--cu-500)", marginBottom: "var(--sp-2)" }}>
                Inventory Copilot v1.0
              </div>
              <div style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)", lineHeight: "var(--lh-relaxed)", marginBottom: "var(--sp-4)" }}>
                A retail decision-intelligence system combining LightGBM quantile demand forecasting, base-stock safety stock optimization, deterministic inventory simulation, and a LangGraph copilot grounded on real data tool outputs.
              </div>
              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                {["Next.js 15", "React 19", "TypeScript", "FastAPI", "LangGraph", "LightGBM", "DuckDB", "Recharts"].map((tech) => (
                  <span key={tech} className="badge badge-neutral" style={{ fontSize: "var(--ts-2xs)" }}>
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
