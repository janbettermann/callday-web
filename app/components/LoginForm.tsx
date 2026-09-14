"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSupabaseBrowser } from "@/lib/supabase-browser";

import { CalldayLogo } from "./CalldayLogo";

/**
 * Sign-In-Formular mit drei Auth-Methoden:
 *   1. Apple (OAuth via Supabase)
 *   2. Google (OAuth via Supabase)
 *   3. Email + Password (Default), Fallback "Forgot password?" → OTP-Flow
 *
 * Einsatzorte:
 *   - /login (Vollseite, `variant="page"`): Query-Params kommen als Props.
 *   - Auth-Popup der Landings (`variant="modal"`, siehe SignupModal): der
 *     Nav-Link "Log in" oeffnet es, und der Wechsel zu "Sign up" passiert
 *     im Popup (`onSwitchToSignup`) statt per Navigation.
 *   - In-App-Browser (`embed`): Email/Passwort hinter einem Link.
 *
 * Mode-State steuert welche Form sichtbar ist:
 *   - signin       : Email + Password (Default)
 *   - otp-email    : Email-only, sendet 8-stelligen Code
 *   - otp-code     : Code-Input (8 Ziffern)
 *
 * KEIN Sign-Up-Modus (entfernt 2026-07-05): Sign-up laeuft ausschliesslich
 * ueber die SignupForm der Landing, nur dort haengt die Post-Signup-Mail
 * (Weg zur App) dran.
 *
 * Reset-Password gibt's nicht als eigenen Flow: Forgot-Password leitet zum
 * OTP-Mode, da der User sich damit auch ohne Passwort einloggen kann.
 *
 * OAuth-Flow:
 *   1. Setze login_next-Cookie (so weiss /auth/callback wohin nach Exchange)
 *   2. signInWithOAuth({ provider, options: { redirectTo: /auth/callback } })
 *   3. Supabase redirected zu Apple/Google, dann zu /auth/callback?code=…
 *   4. /auth/callback exchangt Code fuer Session, redirected zu next
 */

const CODE_LENGTH = 8;

type Mode = "signin" | "otp-email" | "otp-code";
type Status = "idle" | "submitting" | "error";

/**
 * Cleart auf Mount stale Affiliate-State-Cookies. Wer explizit einloggt,
 * hat keine Affiliate-Intention mehr; sonst koennte ein vor 4 Min gesetzter
 * affiliate_slug-Cookie (z. B. nach OAuth-Cancel auf /a/joe) den naechsten
 * regulaeren Sign-In an Joe falsch attribuieren. Siehe Audit-Finding #1.
 */
function useAffiliateCookieCleanup() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.cookie = "affiliate_slug=; path=/; max-age=0; samesite=lax";
    document.cookie = "affiliate_signup_provider=; path=/; max-age=0; samesite=lax";
  }, []);
}

/**
 * Heuristik: erkennt Errors, die typischerweise auftreten, wenn der User
 * mit der "falschen" Methode fuer sein Konto einloggt (z. B. existiert via
 * Apple-OAuth, probiert aber Email/PW). Supabase liefert keine
 * strukturierten Codes dafuer; False-Positives sind ungefaehrlich, wir
 * zeigen nur einen zusaetzlichen Hinweis.
 */
function isLikelyProviderConflict(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("identity already") ||
    m.includes("invalid login credentials")
  );
}

/**
 * "Email not confirmed": User hat sich registriert, den Code aber nie
 * eingegeben. Wir springen dann in den OTP-Step statt ihn haengen zu lassen.
 */
function isEmailNotConfirmed(error: { message?: string; code?: string }): boolean {
  if (error.code === "email_not_confirmed") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed");
}

export interface LoginFormProps {
  /** Interner Pfad nach dem Login. Default: Dashboard. */
  next?: string;
  presetEmail?: string;
  initialError?: string | null;
  /** In-App-Browser-Variante: Email/Passwort hinter einem Link, kein Sign-up-Hinweis. */
  embed?: boolean;
  /**
   * "page" = grosse Headline, alle Felder offen (/login).
   * "modal" = Popup der Landing (Jan-Decision 2026-09-14): erst nur Apple
   * und Google plus Link "Sign in with email"; der Klick ist die bewusste
   * Entscheidung, danach sind die OAuth-Buttons weg und E-Mail plus
   * Passwort stehen sofort da. Keine "New to Callday?"-Fusszeile, der
   * Wechsel laeuft ueber die Kopfzeile.
   */
  variant?: "page" | "modal";
}

export function LoginForm({
  next = "/dashboard",
  presetEmail = "",
  initialError = null,
  embed = false,
  variant = "page",
}: LoginFormProps) {
  const router = useRouter();

  useAffiliateCookieCleanup();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const inModal = variant === "modal";
  // Embed und Popup verstecken Email/Passwort initial (OAuth zuerst, Mail
  // per Klick); die Vollseite zeigt alles sofort. Im Popup verschwinden
  // nach dem Klick zusaetzlich die OAuth-Buttons.
  const [emailRevealed, setEmailRevealed] = useState(!(embed || inModal));
  const showOAuth = !(inModal && emailRevealed);

  function resetMessages() {
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function setLoginNextCookie() {
    if (typeof document === "undefined") return;
    const value = encodeURIComponent(next);
    document.cookie = `login_next=${value}; path=/; max-age=600; samesite=lax`;
  }

  async function handleOAuth(provider: "apple" | "google") {
    if (status === "submitting") return;
    resetMessages();
    setStatus("submitting");
    setLoginNextCookie();

    const supabase = createSupabaseBrowser();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    // signInWithOAuth navigiert den Browser weg, kein router.push noetig.
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !email || !password) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      // Recovery-Pfad: registriert, Code nie eingegeben. Direkt in den
      // OTP-Step OHNE neuen Code zu triggern (Supabase-Rate-Limit); der
      // Resend-Button im OTP-Step holt bei Bedarf einen frischen.
      if (isEmailNotConfirmed(error)) {
        setStatus("idle");
        setMode("otp-code");
        setInfoMessage(
          `Your email isn't confirmed yet. Enter the ${CODE_LENGTH}-digit code we sent to ${cleanEmail} — or request a new one if it expired.`,
        );
        return;
      }
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    router.push(next);
  }

  /** Resend im OTP-Step. Bei Rate-Limit zeigen wir die Meldung und lassen
   *  den User den ALTEN Code aus dem Postfach versuchen. */
  async function handleResendOtp() {
    if (status === "submitting" || !email) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setStatus("idle");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setInfoMessage(`A new ${CODE_LENGTH}-digit code is on its way to ${email.trim()}.`);
    setCode("");
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !email) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    // KEIN emailRedirectTo → reiner Code-Flow ohne Magic-Link.
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("idle");
    setMode("otp-code");
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    resetMessages();
    if (code.length !== CODE_LENGTH) {
      setErrorMessage(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    // type: "email" deckt normales OTP-Login und den Confirm-Signup-Token ab.
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
    router.push(next);
  }

  function switchMode(newMode: Mode) {
    resetMessages();
    setStatus("idle");
    setCode("");
    setMode(newMode);
  }

  const cardClass = `login-card${embed ? " login-card--embed" : ""}`;

  // === Render: OTP-Code-Step ===
  if (mode === "otp-code") {
    return (
      <div className={cardClass}>
        <Heading inModal={inModal} title="Check your inbox.">
          {infoMessage ?? (
            <>
              We sent an {CODE_LENGTH}-digit code to <strong>{email}</strong>. Enter it below to
              sign in.
            </>
          )}
        </Heading>

        <form className="beta-form" onSubmit={handleVerifyCode} noValidate>
          <label className="beta-field">
            <span className="beta-field-label">Sign-in code</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              placeholder="12345678"
              disabled={status === "submitting"}
              style={{
                letterSpacing: "0.4em",
                textAlign: "center",
                fontSize: "22px",
                fontFamily: "ui-monospace, 'SF Mono', Monaco, Consolas, monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </label>

          <button
            type="submit"
            className="beta-submit"
            aria-busy={status === "submitting"}
            disabled={status === "submitting"}
          >
            {status === "submitting" ? "Verifying..." : "Sign in"}
          </button>

          {errorMessage && (
            <p className="beta-submit-error" role="alert">
              {errorMessage}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={handleResendOtp}
          disabled={status === "submitting" || !email}
          className="login-text-link"
          style={{ display: "block", margin: "16px auto 0" }}
        >
          Didn&apos;t get the code? Send a new one
        </button>

        <button type="button" onClick={() => switchMode("signin")} className="login-back-link">
          ← Wrong email? Start over
        </button>
      </div>
    );
  }

  // === Render: OTP-Email-Step ===
  if (mode === "otp-email") {
    return (
      <div className={cardClass}>
        <Heading inModal={inModal} title="Sign in with a code">
          We&apos;ll email you an {CODE_LENGTH}-digit code. No password needed.
        </Heading>

        <form className="beta-form" onSubmit={handleSendOtp}>
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
            aria-busy={status === "submitting"}
            disabled={!email || status === "submitting"}
          >
            {status === "submitting" ? "Sending..." : "Send code"}
          </button>

          {errorMessage && (
            <p className="beta-submit-error" role="alert">
              {errorMessage}
            </p>
          )}
        </form>

        <button type="button" onClick={() => switchMode("signin")} className="login-back-link">
          ← Back to password sign-in
        </button>
      </div>
    );
  }

  // === Render: signin ===
  return (
    <div className={cardClass}>
      {embed ? (
        <>
          <div className="login-embed-brand">
            <span className="login-embed-glow" aria-hidden />
            <CalldayLogo size={52} />
          </div>
          <p className="login-sub login-embed-sub">Sign in to generate your list</p>
        </>
      ) : (
        <Heading inModal={inModal} title={inModal ? "Welcome back" : "Sign in to Callday"}>
          {inModal
            ? emailRevealed
              ? "Sign in with your email and password."
              : "Sign in to your Callday account."
            : "Welcome back. Pick a method to continue."}
        </Heading>
      )}

      {showOAuth && (
        <div className="login-oauth-stack">
          <button
            type="button"
            className="login-oauth-btn login-oauth-btn-apple"
            onClick={() => handleOAuth("apple")}
            disabled={status === "submitting"}
          >
            <AppleIcon />
            <span>Continue with Apple</span>
          </button>
          <button
            type="button"
            className="login-oauth-btn login-oauth-btn-google"
            onClick={() => handleOAuth("google")}
            disabled={status === "submitting"}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
        </div>
      )}

      {emailRevealed ? (
        <>
          {showOAuth && (
            <div className="login-divider">
              <span>or</span>
            </div>
          )}

          <form className="beta-form" onSubmit={handlePasswordSubmit}>
            <label className="beta-field">
              <span className="beta-field-label">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={status === "submitting"}
              />
            </label>

            <label className="beta-field">
              <span className="beta-field-label">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                disabled={status === "submitting"}
              />
            </label>

            <button
              type="submit"
              className="beta-submit"
              aria-busy={status === "submitting"}
              disabled={!email || !password || status === "submitting"}
            >
              {status === "submitting" ? "Signing in..." : "Sign in"}
            </button>

            {errorMessage && (
              <>
                <p className="beta-submit-error" role="alert">
                  {errorMessage}
                </p>
                {isLikelyProviderConflict(errorMessage) && (
                  <p className="login-hint">
                    Already signed up with Apple or Google? Try the buttons above — accounts are
                    tied to the method you first used.
                  </p>
                )}
              </>
            )}
          </form>

          <div className="login-link-row">
            <button
              type="button"
              className="login-text-link"
              onClick={() => {
                switchMode("otp-email");
                setInfoMessage(
                  "Sign in with a one-time code, then change your password in your account.",
                );
              }}
            >
              Forgot password?
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={inModal ? "login-email-link" : "login-text-link login-embed-email-link"}
          onClick={() => setEmailRevealed(true)}
        >
          Sign in with email
        </button>
      )}

      {/* Sign-up lebt auf der Landing. Auf /login als Link zur Landing-Card;
          im Popup (Wechsel ueber die Kopfzeile) und im Embed-Modus (User
          hat schon ein Konto) ausgeblendet. */}
      {!embed && !inModal && (
        <div className="login-switch-mode">
          New to Callday?{" "}
          <Link href="/#signup" className="login-text-link login-text-link-strong">
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}

/** Kopf der Karte: gross und zentriert auf /login, klein wie das Sign-up-Popup im Modal. */
function Heading({
  inModal,
  title,
  children,
}: {
  inModal: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (inModal) {
    return (
      <>
        <h3 className="login-card-title">{title}</h3>
        <p className="login-card-sub">{children}</p>
      </>
    );
  }
  return (
    <>
      <h1 className="login-headline">{title}</h1>
      <p className="login-sub">{children}</p>
    </>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
