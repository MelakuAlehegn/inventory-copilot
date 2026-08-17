// Instant navigation frame: shown immediately on route change while the page's server
// data loads, so the previous page doesn't appear frozen. Mirrors the topbar + page-body
// shape (a KPI strip and two content blocks) shared by most pages.

function Bar({ w, h = 14 }: { w: number | string; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: "var(--r-sm)" }} />;
}

function CardSkeleton({ height }: { height: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <Bar w={140} h={12} />
      <div className="skeleton" style={{ width: "100%", height: height, borderRadius: "var(--r-sm)" }} />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-title" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Bar w={160} h={16} />
          <Bar w={260} h={10} />
        </div>
        <div className="topbar-actions">
          <Bar w={64} h={30} />
          <Bar w={30} h={30} />
        </div>
      </header>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-4)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <Bar w={90} h={10} />
              <Bar w={120} h={28} />
              <Bar w={70} h={10} />
            </div>
          ))}
        </div>

        {/* Two content blocks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)" }}>
          <CardSkeleton height={220} />
          <CardSkeleton height={220} />
        </div>
      </div>
    </>
  );
}
