"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * /login — Magic-Link-Auth.
 *
 * Flow:
 *   1. User trägt Email ein, submitted das Form
 *   2. supabase.auth.signInWithOtp() sendet Magic-Link an die Adresse
 *   3. Link in der Mail führt zu /auth/callback?code=PKCE_CODE&next=<original>
 *   4. /auth/callback tauscht den Code für eine Session + redirected zu next
 *
 * Query-Params (optional):
 *   ?next=<path>     → wohin nach erfolgreichem Login (default: /)
 *                      typisch: /checkout?code=CALLDAY-XYZ
 *   ?email=<email>   → vorausgefüllt (z.B. wenn vom Founder-Code-Mail-Link)
 *
 * Supabase erlaubt Signup + Signin in einem Call — wenn die Email
 * unbekannt ist, wird via handle_new_user-Trigger ein Profile angelegt.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const presetEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(presetEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || !email) return;

    setStatus("sending");
    setErrorMessage(null);

    const supabase = createSupabaseBrowser();

    // Wir merken uns das next-Ziel in einem Cookie statt es als Query-
    // Param in emailRedirectTo zu hängen. Supabase strippt sonst die
    // Query-String beim URL-Matching gegen die Redirect-Allow-List und
    // unser /auth/callback verliert das next. Cookie-Ansatz hält das
    // Ziel sauber + sicher (SameSite=Lax + 10min Lifetime).
    document.cookie = `login_next=${encodeURIComponent(next)}; path=/; max-age=600; SameSite=Lax`;

    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="confirm-inner">
        <div className="confirm-icon">
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="confirm-headline">Check your inbox.</h1>
        <p className="confirm-body">
          We sent a sign-in link to <strong>{email}</strong>. Click it to
          continue. If you don&apos;t see it within a minute, check spam.
        </p>
        <p className="confirm-body" style={{ fontSize: "14px" }}>
          You can close this tab — the link opens in a fresh window.
        </p>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1 className="login-headline">Sign in to Callday</h1>
      <p className="login-sub">
        We&apos;ll email you a one-tap sign-in link. No password.
      </p>

      <form className="beta-form" onSubmit={handleSubmit}>
        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "sending"}
          />
        </label>

        <button
          type="submit"
          className="beta-submit"
          disabled={!email || status === "sending"}
        >
          {status === "sending" ? "Sending..." : "Send sign-in link"}
        </button>

        {status === "error" && errorMessage && (
          <p className="beta-submit-error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

      <main className="confirm-page">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="logo">
            <CalldayLogo size={28} />
            Callday
          </div>
          <div className="footer-tagline">MAKE TODAY A CALLDAY.</div>
          <div className="footer-meta">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </footer>
    </>
  );
}
