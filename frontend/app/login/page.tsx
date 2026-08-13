"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || null }),
        });
        if (!res.ok) {
          setError(res.status === 409 ? "That email is already registered." : "Could not create the account.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
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

        <h1 className="auth-heading">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-sub">
          {mode === "signin"
            ? "Sign in to access your forecasts, inventory recommendations, and scenario analysis."
            : "Set up an account to save scenarios and chat with the copilot."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {mode === "signup" && (
            <input className="input" type="text" placeholder="Name (optional)" value={name}
              onChange={(e) => setName(e.target.value)} autoComplete="name" />
          )}
          <input className="input" type="email" placeholder="Email" value={email} required
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" type="password" placeholder="Password" value={password} required
            minLength={8} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"} />

          {error && (
            <div role="alert" style={{ color: "var(--danger)", fontSize: "var(--ts-sm)" }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p style={{ fontSize: "var(--ts-sm)", color: "var(--tx-tertiary)", marginTop: "var(--sp-3)" }}>
          {mode === "signin" ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            style={{ background: "none", border: "none", color: "var(--cu-500)", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", margin: "var(--sp-5) 0", color: "var(--tx-tertiary)", fontSize: "var(--ts-xs)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--divider)" }} />
          or
          <div style={{ flex: 1, height: 1, background: "var(--divider)" }} />
        </div>

        <button className="oauth-btn" onClick={() => signIn("google", { callbackUrl: "/" })} id="login-google">
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="auth-note">
          By continuing you accept the terms of this demo.
        </p>
      </div>
    </div>
  );
}
