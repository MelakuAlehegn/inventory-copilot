"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-mark" style={{ width: 36, height: 36 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="logo-name" style={{ fontSize: "1rem" }}>Inventory Copilot</div>
            <div className="logo-sub">Decision Intelligence</div>
          </div>
        </div>

        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-sub">
          Sign in to access your forecasts, inventory recommendations,
          and AI-powered scenario analysis.
        </p>

        <div>
          <button
            className="oauth-btn"
            onClick={() => signIn("github", { callbackUrl: "/" })}
            id="login-github"
          >
            <Github size={18} />
            Continue with GitHub
          </button>

          <button
            className="oauth-btn"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            id="login-google"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        {/* What this is */}
        <div style={{ marginTop: "var(--sp-10)", paddingTop: "var(--sp-6)", borderTop: "1px solid var(--divider)" }}>
          <p style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", lineHeight: "var(--lh-relaxed)" }}>
            <strong style={{ color: "var(--tx-secondary)", fontWeight: "var(--fw-semibold)" }}>What is this?</strong><br />
            A production-grade retail AI system: LightGBM quantile forecasting,
            base-stock inventory policy, what-if simulations, and a grounded
            LangGraph agent that only reports numbers it actually computed.
          </p>
          <div style={{ marginTop: "var(--sp-4)", display: "flex", gap: "var(--sp-4)" }}>
            {[
              { label: "WRMSSE vs naive", value: "+19.6%" },
              { label: "Stockout reduction", value: "−11.2%" },
              { label: "M5 series", value: "14,370" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-md)", fontWeight: "var(--fw-bold)", color: "var(--cu-500)" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="auth-note">
          By signing in you accept the terms of this demo.<br />
          No data from your account is stored beyond sessions.
        </p>
      </div>
    </div>
  );
}
