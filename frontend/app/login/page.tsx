"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Warehouse, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Theme = "light" | "dark";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as Theme) || "light");
  }, []);

  const flipTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const el = document.documentElement;
    el.setAttribute("data-theme", next);
    el.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

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
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={flipTheme}
        aria-label="Toggle theme"
        className="absolute right-4 top-4"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <div className="panel w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Warehouse className="size-[18px]" />
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight">Inventory Copilot</p>
            <p className="text-[11px] text-muted-foreground">Decision intelligence</p>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to access your forecasts, inventory recommendations, and scenario analysis."
            : "Set up an account to save scenarios and chat with the copilot."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "signup" ? (
            <Input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          ) : null}
          <Input type="email" placeholder="Email" value={email} required onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input type="password" placeholder="Password" value={password} required minLength={8} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />

          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signin" ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl: "/" })} id="login-google">
          <GoogleIcon /> Continue with Google
        </Button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">By continuing you accept the terms of this demo.</p>
      </div>
    </div>
  );
}
