"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionAccessToken } from "@/lib/auth-client";

type Mode = "login" | "register";

const PASSWORD_RULE_MESSAGE =
  "Password must be at least 6 characters and include at least 1 letter, 1 number, and 1 special character.";

function isValidPassword(password: string) {
  if (password.length < 6) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasLetter && hasNumber && hasSpecial;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const candidate = searchParams.get("next");
    return candidate && candidate.startsWith("/") ? candidate : null;
  }, [searchParams]);

  async function resolvePostLoginPath() {
    if (nextPath) return nextPath;

    const token = await getSessionAccessToken();
    if (!token) return "/dashboard";

    const res = await fetch("/api/products", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return "/dashboard";

    const data = await res.json();
    const firstProductId: string | undefined = data.products?.[0]?.id;

    if (!firstProductId) return "/dashboard";
    return `/dashboard?product_id=${encodeURIComponent(firstProductId)}`;
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!alive || !session) return;
      const destination = await resolvePostLoginPath();
      router.replace(destination);
    })();

    return () => {
      alive = false;
    };
  }, [router, nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        if (!isValidPassword(password)) {
          throw new Error(PASSWORD_RULE_MESSAGE);
        }

        const { error: registerError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              username: trimmedEmail.split("@")[0],
            },
          },
        });

        if (registerError) throw registerError;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (loginError) throw loginError;

      const destination = await resolvePostLoginPath();
      router.replace(destination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      if (message.toLowerCase().includes("email not confirmed")) {
        setError("Email not confirmed. Please check your mailbox and verify your email first.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <h1>{mode === "login" ? "Login" : "Register"}</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Use your email and password to access your dashboard and private product leads.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          {mode === "register" && (
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "-0.45rem" }}>
              {PASSWORD_RULE_MESSAGE}
            </p>
          )}

          {error && <div className="status-msg error">{error}</div>}

          <button type="submit" className="btn-generate" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <div style={{ marginTop: "1rem", fontSize: "0.95rem" }}>
          {mode === "login" ? "Need an account? " : "Already registered? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              color: "#7c3aed",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
