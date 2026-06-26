"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const SIGNUP_VALIDATION_MESSAGE =
  "Add email and password — or use Apple or Google above.";
const OTP_VALIDATION_MESSAGE = `Enter the ${8}-digit code from your email.`;

/**
 * Detection fuer "User already registered"-Errors aus supabase.auth.signUp.
 * Typischer Fall: User hat hier vorher Sign-Up gemacht, Tab geschlossen
 * bevor er den Code eingegeben hat, kommt jetzt zurueck und probiert
 * nochmal. Ohne Recovery-Pfad waere er stuck. Wir erkennen den Error
 * und schicken automatisch einen frischen Code, springen in OTP-Mode.
 */
function isUserAlreadyRegistered(error: {
  message?: string;
  code?: string;
}): boolean {
  if (error.code === "user_already_exists") return true;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("user already")
  );
}

/**
 * Affiliate-Sign-Up-Form fuer /a/[slug].
 *
 * Default-Mode ist SIGNUP (im Unterschied zu /login das auf SIGNIN
 * defaultet). Affiliate-Pill ueber dem Form macht die Empfehlung
 * sichtbar (sofern slug aktiv aufgeloest wurde).
 *
 * Slug-Transport durch den Sign-Up-Flow:
 *   - Email/PW: user_metadata.referred_by_affiliate_slug → handle_new_user
 *     Trigger resolvet zu profiles.referred_by_affiliate_id in derselben
 *     INSERT-Transaktion.
 *   - Apple/Google OAuth: kurzlebiger `affiliate_slug`-Cookie (5 min,
 *     samesite=lax) — Supabase strippt Query-Params von redirectTo, daher
 *     identisches Pattern wie das existierende `login_next`-Cookie in
 *     /login. /auth/callback liest den Cookie und UPDATEd profiles nach
 *     dem PKCE-Exchange. Das ist OAuth-State-Plumbing, kein
 *     Marketing-Tracking-Cookie (siehe Plan-Decision in
 *     project_beta_affiliate_program).
 *
 * Edge-Case: Slug unknown / Affiliate paused → kommt als affiliate=null
 * rein. Pill wird nicht angezeigt, FK bleibt null (silent fallback zu
 * organic). Sign-Up funktioniert trotzdem.
 *
 * Nach erfolgreichem Sign-Up landet der User auf /account?welcome=affiliate
 * — siehe TestFlight-Recovery-Section in /account.
 */

const CODE_LENGTH = 8;

type Mode = "signup" | "otp-code";
type Status = "idle" | "submitting" | "error";

interface Affiliate {
  slug: string;
  name: string;
}

interface Props {
  slug: string;
  affiliate: Affiliate | null;
}

// 5 Minuten = OAuth-Round-Trip-Realismus. Vorher waren das 10 Min,
// was die Window auf Stale-Cookie-Leaks (User cancelt OAuth, geht spaeter
// auf /login) breiter machte als noetig. /login + /auth/callback loeschen
// die Cookies jetzt zusaetzlich aktiv, dieser Wert ist die letzte
// Verteidigung.
const AFFILIATE_COOKIE_MAX_AGE_S = 300;

function setAffiliateSlugCookie(slug: string) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(slug);
  document.cookie = `affiliate_slug=${value}; path=/; max-age=${AFFILIATE_COOKIE_MAX_AGE_S}; samesite=lax`;
}

function setLoginNextCookie(next: string) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(next);
  document.cookie = `login_next=${value}; path=/; max-age=${AFFILIATE_COOKIE_MAX_AGE_S}; samesite=lax`;
}

export function AffiliateSignupForm({ slug, affiliate }: Props) {
  const router = useRouter();
  const posthog = usePostHog();

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const landingFiredRef = useRef(false);
  const startedFiredRef = useRef(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // affiliate_landing_view (genau einmal pro Mount). slug ist die canonical
  // Property — auch bei unknown/paused-Slugs feuern wir, damit Admin-Dashboard
  // den Drop "Landing aber kein Affiliate aktiv" sieht.
  useEffect(() => {
    if (landingFiredRef.current) return;
    landingFiredRef.current = true;
    posthog?.capture("affiliate_landing_view", {
      slug,
      affiliate_resolved: affiliate !== null,
    });
  }, [posthog, slug, affiliate]);

  function fireStarted() {
    if (startedFiredRef.current) return;
    startedFiredRef.current = true;
    posthog?.capture("affiliate_signup_started", { slug });
  }

  function fireCompleted(authProvider: "email" | "apple" | "google") {
    posthog?.capture("affiliate_signup_completed", {
      slug,
      auth_provider: authProvider,
    });
  }

  function resetMessages() {
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleOAuth(provider: "apple" | "google") {
    if (status === "submitting") return;
    resetMessages();
    fireStarted();
    setStatus("submitting");

    // affiliate_signup_completed feuert NICHT hier — User navigiert weg via
    // signInWithOAuth, kommt nach PKCE-Exchange auf /account?welcome=affiliate
    // mit Query-Param signup_completed=<provider>. /account triggert von dort
    // den completed-Event. Damit zaehlt nur ECHTER OAuth-Erfolg, nicht
    // bloss "OAuth-Button geklickt".

    setAffiliateSlugCookie(slug);
    // Provider durch /auth/callback durchreichen damit /account weiss welcher
    // Provider abgeschlossen hat — wir nutzen denselben Cookie-Mechanismus
    // wie fuer den Slug.
    if (typeof document !== "undefined") {
      document.cookie = `affiliate_signup_provider=${provider}; path=/; max-age=${AFFILIATE_COOKIE_MAX_AGE_S}; samesite=lax`;
    }
    setLoginNextCookie("/account?welcome=affiliate");

    const supabase = createSupabaseBrowser();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
    // signInWithOAuth navigiert weg — kein router.push noetig.
  }

  /**
   * Resend-Action im OTP-Step (siehe Render unten). Triggert frischen
   * Code via signInWithOtp. Bei Rate-Limit zeigen wir Supabase's Message
   * direkt — User kann es nach der angegebenen Wartezeit erneut versuchen.
   */
  async function handleResendOtp() {
    if (status === "submitting" || !email) return;
    resetMessages();
    setStatus("submitting");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    setStatus("idle");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setInfoMessage(`A new ${CODE_LENGTH}-digit code is on its way to ${email.trim()}.`);
    setCode("");
  }

  async function sendPostSignupMail() {
    // Fire-and-forget — Failures sind nicht kritisch fuer den Sign-Up-Flow.
    // Account-Page hat einen Resend-Button als Recovery-Pfad. Server
    // liest die Ziel-Email aus der SSR-Session (kein Body noetig).
    try {
      await fetch("/api/affiliate/post-signup", { method: "POST" });
    } catch (err) {
      console.error("[/a/[slug]] post-signup mail failed", err);
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    resetMessages();

    // Client-Validation statt disabled-Button: User klickt → wir geben
    // konkretes Feedback ("Email + Password noetig — oder Apple/Google").
    // Vorher war der Button bei leeren Feldern disabled, was den
    // wait-Cursor triggerte und das OAuth-Alternativ-Path nicht erklaerte.
    if (!email.trim() || !password) {
      setErrorMessage(SIGNUP_VALIDATION_MESSAGE);
      if (!email.trim()) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
      return;
    }

    fireStarted();
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        // handle_new_user Trigger liest das hier und schreibt es als
        // profiles.referred_by_affiliate_id (atomisch im selben INSERT).
        data: { referred_by_affiliate_slug: slug },
      },
    });

    if (error) {
      // Recovery-Pfad: User hat sich schon registriert (Tab vorher
      // geschlossen) → direkt in den OTP-Step OHNE neuen Code zu
      // triggern. Sonst kollidieren wir mit dem Supabase-Rate-Limit
      // ("can only request this after N seconds") wenn der Original-
      // Code grade erst rausging. User kann den alten Code probieren;
      // falls abgelaufen → Resend-Button im OTP-Step.
      if (isUserAlreadyRegistered(error)) {
        setStatus("idle");
        setMode("otp-code");
        setInfoMessage(
          `Welcome back. Enter the ${CODE_LENGTH}-digit code we sent to ${cleanEmail} — or request a new one if it expired.`,
        );
        return;
      }
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // signUp erfolgreich — Email/PW-completed feuern. Bei aktivierter
    // Email-Confirmation laeuft als naechstes der OTP-Flow, aber der
    // Account existiert dann schon in auth.users — das ist hier der
    // konversions-relevante Moment.
    fireCompleted("email");

    // Email-Confirmation aktiv → session ist null, User muss OTP-Code aus
    // der Mail eintippen. Kein Magic-Link, reiner Code. TestFlight-Mail
    // wird ERST nach erfolgreichem verifyOtp rausgeschickt — sonst landen
    // zwei Mails parallel im Postfach (Verification + TestFlight) was
    // verwirrend ist + Typo-Emails kriegen unnoetig TestFlight-Links.
    if (!data.session) {
      setStatus("idle");
      setMode("otp-code");
      setInfoMessage(
        `We sent an ${CODE_LENGTH}-digit code to ${cleanEmail}. Enter it to confirm your account.`,
      );
      return;
    }

    // Auto-confirmed (z.B. dev-Env oder Confirmation off) → TestFlight-Mail
    // jetzt senden, dann zu /account.
    void sendPostSignupMail();
    router.push("/account?welcome=affiliate");
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    resetMessages();

    // Client-Validation statt disabled-Button (selbe Logik wie SignupSubmit).
    if (code.length !== CODE_LENGTH) {
      setErrorMessage(OTP_VALIDATION_MESSAGE);
      return;
    }

    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Email ist jetzt verifiziert — TestFlight-Mail rausschicken.
    // Fire-and-forget; Account-Page hat Resend-Button als Recovery.
    void sendPostSignupMail();

    router.push("/account?welcome=affiliate");
  }

  // === Render: OTP-Code-Step (nach Email/PW Sign-Up) ===
  if (mode === "otp-code") {
    return (
      <div className="login-card">
        <h1 className="login-headline">Check your inbox.</h1>
        <p className="login-sub">
          {infoMessage ?? (
            <>
              We sent an {CODE_LENGTH}-digit code to <strong>{email}</strong>.
              Enter it below to confirm your account.
            </>
          )}
        </p>

        <form className="beta-form" onSubmit={handleVerifyCode} noValidate>
          <label className="beta-field">
            <span className="beta-field-label">Sign-up code</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
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

          {/* maxLength bewusst NICHT auf dem Input — wenn der User einen
              formatierten Code paste'd (z.B. "1234 5678" mit Space), wuerde
              maxLength=8 die Eingabe VOR onChange truncaten und das Regex
              koennte die 8 Digits nicht mehr extrahieren. Stattdessen
              uebernimmt der replace+slice im onChange die Begrenzung. */}

          <button
            type="submit"
            className="beta-submit"
            aria-busy={status === "submitting"}
            disabled={status === "submitting"}
          >
            {status === "submitting" ? "Verifying..." : "Confirm account"}
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
      </div>
    );
  }

  // === Render: Sign-Up ===
  // Pill + Headline + Sub bewusst weggelassen — die Page-Hero ueber dem
  // Form liefert den Pitch (siehe app/a/[slug]/page.tsx, identisch zur
  // organic Landing). Form bleibt als reine Action-Section.
  // Affiliate-Attribution laeuft komplett im Backend (Trigger / Callback)
  // — Affiliate erscheint nirgendwo auf der Seite (Jan-Decision).
  return (
    <div className="login-card">
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

      <form className="beta-form" onSubmit={handleSignupSubmit} noValidate>
        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            ref={emailInputRef}
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
            ref={passwordInputRef}
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={status === "submitting"}
          />
        </label>

        <button
          type="submit"
          className="beta-submit"
          aria-busy={status === "submitting"}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Creating account..." : "Create account"}
        </button>

        {errorMessage && (
          <p className="beta-submit-error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>

      <div className="login-switch-mode">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent("/account")}`}
          className="login-text-link login-text-link-strong"
        >
          Sign in
        </Link>
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
