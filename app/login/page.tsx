"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * /login — Email + OTP-Code-Flow.
 *
 * Replaced den vorigen Magic-Link-Flow weil Gmail-Prefetcher (und einige
 * andere Mail-Provider) Links im Hintergrund "öffnen" um sie auf Phishing
 * zu prüfen. Damit wurde der Single-Use-Magic-Link konsumiert bevor der
 * User selber clicken konnte → "otp_expired"-Error.
 *
 * OTP-Codes sind immun: ein 8-stelliger Code lässt sich nicht "klicken",
 * der User muss ihn aktiv eintippen.
 *
 * Code-Länge 8 matched die Convention vom Mobile-Repo
 * (dealswipe-app/app/onboarding/verify-reset-code.tsx). Damit ist der
 * Supabase-Project-OTP-Length konsistent für Web-Login + Mobile-Reset.
 *
 * Zwei-Step-Flow:
 *   1. User trägt Email ein → signInWithOtp() sendet Mail mit Code
 *   2. User trägt Code ein → verifyOtp() validiert + setzt Session
 *
 * Query-Params:
 *   ?next=<path>   wohin nach erfolgreichem Login (default: /)
 *   ?email=<email> Email vorausgefüllt
 */

const CODE_LENGTH = 8;

type Step = "email" | "code";
type Status = "idle" | "submitting" | "error";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const presetEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !email) return;

    setStatus("submitting");
    setErrorMessage(null);

    const supabase = createSupabaseBrowser();

    // KEIN emailRedirectTo — wir wollen reinen Code-Flow ohne Magic-Link.
    // Supabase Email-Template muss {{ .Token }} prominent rendern statt
    // {{ .ConfirmationURL }} (siehe Setup-Doku).
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("idle");
    setStep("code");
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || code.length !== CODE_LENGTH) return;

    setStatus("submitting");
    setErrorMessage(null);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Session ist jetzt gesetzt — Cookies geschrieben, weiter zum Ziel.
    router.push(next);
  }

  function startOver() {
    setStep("email");
    setCode("");
    setErrorMessage(null);
    setStatus("idle");
  }

  if (step === "code") {
    return (
      <div className="login-card">
        <h1 className="login-headline">Check your inbox.</h1>
        <p className="login-sub">
          We sent an {CODE_LENGTH}-digit code to <strong>{email}</strong>.
          Enter it below to sign in.
        </p>

        <form className="beta-form" onSubmit={handleVerifyCode}>
          <label className="beta-field">
            <span className="beta-field-label">Sign-in code</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
              }
              placeholder="12345678"
              disabled={status === "submitting"}
              style={{
                letterSpacing: "0.4em",
                textAlign: "center",
                fontSize: "22px",
                fontFamily:
                  "ui-monospace, 'SF Mono', Monaco, Consolas, monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </label>

          <button
            type="submit"
            className="beta-submit"
            disabled={code.length !== CODE_LENGTH || status === "submitting"}
          >
            {status === "submitting" ? "Verifying..." : "Sign in"}
          </button>

          {status === "error" && errorMessage && (
            <p className="beta-submit-error" role="alert">
              {errorMessage}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={startOver}
          className="login-back-link"
        >
          ← Wrong email? Start over
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1 className="login-headline">Sign in to Callday</h1>
      <p className="login-sub">
        We&apos;ll email you an {CODE_LENGTH}-digit code. No password.
      </p>

      <form className="beta-form" onSubmit={handleSendCode}>
        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "submitting"}
          />
        </label>

        <button
          type="submit"
          className="beta-submit"
          disabled={!email || status === "submitting"}
        >
          {status === "submitting" ? "Sending..." : "Send code"}
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
