"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * /login — Sign-In + Sign-Up Page mit drei Auth-Methoden:
 *   1. Apple (OAuth via Supabase)
 *   2. Google (OAuth via Supabase)
 *   3. Email + Password (Default) — Fallback "Email me a code" → OTP-Flow
 *
 * Phase 3.6 Auth-Parity: Mobile bietet Apple + Google + Email/Password,
 * Web zieht nach.
 *
 * Mode-State steuert welche Form sichtbar ist:
 *   - signin       : Email + Password (Default)
 *   - signup       : Email + Password (mit signUp() statt signIn)
 *   - otp-email    : Email-only, sendet 8-stelligen Code
 *   - otp-code     : Code-Input (8 Ziffern)
 *
 * Reset-Password gibt's nicht als eigenen Flow — Forgot-Password leitet
 * zum OTP-Mode, da der User sich damit auch ohne Passwort einloggen kann.
 * Passwort-Ändern passiert in /account (oder bleibt einfach beim OTP).
 *
 * OAuth-Flow:
 *   1. Setze login_next-Cookie (so weiß /auth/callback wohin nach Exchange)
 *   2. signInWithOAuth({ provider, options: { redirectTo: /auth/callback } })
 *   3. Supabase redirected zu Apple/Google
 *   4. Provider redirected zu Supabase-Callback
 *   5. Supabase redirected zu unserem /auth/callback?code=PKCE_CODE
 *   6. /auth/callback exchangt Code für Session, redirected zu next
 */

const CODE_LENGTH = 8;

type Mode = "signin" | "signup" | "otp-email" | "otp-code";
type Status = "idle" | "submitting" | "error";

/**
 * Heuristik: erkennt Errors die typischerweise auftreten wenn der User
 * mit der "falschen" Methode für sein Account einloggt (z.B. existiert
 * via Apple-OAuth aber er probiert Email/PW).
 *
 * Supabase liefert keine strukturierten Error-Codes für diese Fälle,
 * daher String-Match auf die häufigsten Messages. False-Positives sind
 * ungefährlich — wir zeigen nur einen zusätzlichen Hint, blocken nichts.
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const presetEmail = searchParams.get("email") || "";
  const initialError = searchParams.get("error");
  // ?mode=signup zeigt direkt die Sign-Up-Variante. Wird vom Checkout-
  // Auth-Gate gesetzt damit User die vom Pricing-CTA kommen nicht im
  // Sign-In-Mode landen ("ich hab doch noch keinen Account").
  const modeParam = searchParams.get("mode");
  const initialMode: Mode = modeParam === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ? decodeURIComponent(initialError) : null,
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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
    // signInWithOAuth navigiert den Browser weg — kein router.push nötig.
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !email || !password) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
      router.push(next);
      return;
    }

    // mode === "signup"
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Wenn Email-Confirmation aktiv ist, ist session=null und der User
    // muss einen Code aus der Mail eintippen (Confirm-Signup-Token).
    if (!data.session) {
      setStatus("idle");
      setMode("otp-code");
      setInfoMessage(
        `We sent an ${CODE_LENGTH}-digit code to ${cleanEmail}. Enter it to confirm your account.`,
      );
      return;
    }

    // Falls Email-Confirmation deaktiviert ist, sind wir direkt drin.
    router.push(next);
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !email) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    // KEIN emailRedirectTo → reiner Code-Flow ohne Magic-Link.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
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
    if (status === "submitting" || code.length !== CODE_LENGTH) return;
    resetMessages();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    // type: "email" deckt sowohl normales OTP-Login als auch den
    // Confirm-Signup-Token ab (Supabase akzeptiert beide am gleichen
    // Endpoint).
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

  // === Render: OTP-Code-Step ===
  if (mode === "otp-code") {
    return (
      <div className="login-card">
        <h1 className="login-headline">Check your inbox.</h1>
        <p className="login-sub">
          {infoMessage ?? (
            <>
              We sent an {CODE_LENGTH}-digit code to <strong>{email}</strong>.
              Enter it below to sign in.
            </>
          )}
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

          {errorMessage && (
            <p className="beta-submit-error" role="alert">
              {errorMessage}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="login-back-link"
        >
          ← Wrong email? Start over
        </button>
      </div>
    );
  }

  // === Render: OTP-Email-Step ===
  if (mode === "otp-email") {
    return (
      <div className="login-card">
        <h1 className="login-headline">Sign in with a code</h1>
        <p className="login-sub">
          We&apos;ll email you an {CODE_LENGTH}-digit code. No password needed.
        </p>

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

        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="login-back-link"
        >
          ← Back to password sign-in
        </button>
      </div>
    );
  }

  // === Render: signin / signup ===
  const isSignUp = mode === "signup";

  return (
    <div className="login-card">
      <h1 className="login-headline">
        {isSignUp ? "Create your account" : "Sign in to Callday"}
      </h1>
      <p className="login-sub">
        {isSignUp
          ? "Start your 7-day free trial. No card required."
          : "Welcome back. Pick a method to continue."}
      </p>

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

      <div className="login-divider">
        <span>or</span>
      </div>

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
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={isSignUp ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            disabled={status === "submitting"}
          />
        </label>

        <button
          type="submit"
          className="beta-submit"
          disabled={!email || !password || status === "submitting"}
        >
          {status === "submitting"
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>

        {errorMessage && (
          <>
            <p className="beta-submit-error" role="alert">
              {errorMessage}
            </p>
            {isLikelyProviderConflict(errorMessage) && (
              <p className="login-hint">
                Already signed up with Apple or Google? Try the buttons
                above — accounts are tied to the method you first used.
              </p>
            )}
          </>
        )}
      </form>

      {!isSignUp && (
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
      )}

      <div className="login-switch-mode">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="login-text-link login-text-link-strong"
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New to Callday?{" "}
            <button
              type="button"
              className="login-text-link login-text-link-strong"
              onClick={() => switchMode("signup")}
            >
              Create an account
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
