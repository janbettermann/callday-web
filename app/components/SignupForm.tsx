"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  sendTestflightInviteMail,
  writeSignupConfirmHandoff,
} from "@/lib/signup-confirm";

const SIGNUP_VALIDATION_MESSAGE =
  "Add email and password — or use Apple or Google above.";

/**
 * Detection fuer "User already registered"-Errors aus supabase.auth.signUp.
 * Typischer Fall: User hat hier vorher Sign-Up gemacht, Tab geschlossen
 * bevor er den Code eingegeben hat, kommt jetzt zurueck und probiert
 * nochmal. Ohne Recovery-Pfad waere er stuck. Wir erkennen den Error
 * und schicken ihn mit "welcome-back"-Handoff zu /confirm.
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
 * Sign-Up-Form fuer die organische Landing (app/page.tsx) UND die
 * Affiliate-Landings (/a/[slug]) — seit 2026-07-05 vereinheitlicht,
 * vorher lief organic ueber die BetaApplicationForm + applications-Tabelle.
 * Einziger Unterschied zwischen den beiden Einsatzorten: `slug` ist auf
 * den Affiliate-Seiten gesetzt und steuert die Attribution.
 *
 * Default-Mode ist SIGNUP (im Unterschied zu /login das auf SIGNIN
 * defaultet).
 *
 * Slug-Transport durch den Sign-Up-Flow (nur wenn slug vorhanden):
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
 * TestFlight-Mail-Trigger:
 *   - Email/PW: /confirm ruft /api/testflight-invite nach erfolgreichem
 *     verifyOtp (siehe ConfirmCard + lib/signup-confirm.ts).
 *   - OAuth: der `signup_flow`-Cookie (gesetzt in handleOAuth) signalisiert
 *     /auth/callback, dass dieser PKCE-Exchange aus einem Sign-Up-Form kam
 *     — der Callback schickt dann die Mail fuer frische Profile. Ohne den
 *     Cookie wuerde ein organischer OAuth-Sign-Up keine Mail bekommen
 *     (der /login-Pfad soll ja keine ausloesen).
 *
 * Edge-Case: Slug unknown / Affiliate paused → Attribution faellt silent
 * zurueck auf organic (FK bleibt null). Sign-Up funktioniert trotzdem.
 *
 * Der OTP-Code-Step lebt seit 2026-07-05 auf der eigenen Route /confirm
 * (Email-Handoff via sessionStorage, siehe lib/signup-confirm.ts) — der
 * fruehere In-Place-Swap war nicht reload-fest und als Funnel-Step
 * unsichtbar. Nach erfolgreichem Confirm landet der User auf dem
 * Dashboard (Post-Login-Startseite seit 2026-07-15).
 */

type Status = "idle" | "submitting" | "error";

// Post-Signup-Landing: das Dashboard ist seit 2026-07-15 die Startseite
// des eingeloggten Bereichs. (Der App-Install-Nudge, frueher die
// welcome=signup-Card auf /account, zieht spaeter als Dashboard-Zustand
// nach — bis dahin fuehrt der Funnel list-first.)
const DEFAULT_NEXT_PATH = "/dashboard";

interface Props {
  /** Affiliate-Slug fuer Attribution — nur auf /a/[slug] gesetzt. */
  slug?: string;
  /**
   * Interner Pfad nach abgeschlossenem Sign-Up (OAuth via login_next-
   * Cookie, Email/PW via /confirm-Handoff). Einstiege mit eigenem
   * Funnel (z. B. /lists) setzen das, damit der User dorthin
   * zurueckkommt; Default ist das Dashboard.
   */
  nextPath?: string;
}

// 5 Minuten = OAuth-Round-Trip-Realismus. Vorher waren das 10 Min,
// was die Window auf Stale-Cookie-Leaks (User cancelt OAuth, geht spaeter
// auf /login) breiter machte als noetig. /login + /auth/callback loeschen
// die Cookies jetzt zusaetzlich aktiv, dieser Wert ist die letzte
// Verteidigung.
const SIGNUP_COOKIE_MAX_AGE_S = 300;

function setSignupCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${SIGNUP_COOKIE_MAX_AGE_S}; samesite=lax`;
}

export function SignupForm({ slug, nextPath = DEFAULT_NEXT_PATH }: Props) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleOAuth(provider: "apple" | "google") {
    if (status === "submitting") return;
    setErrorMessage(null);
    setStatus("submitting");

    if (slug) {
      setSignupCookie("affiliate_slug", slug);
    }
    // Markiert den PKCE-Exchange als Sign-Up-Form-Ursprung — /auth/callback
    // schickt dann die TestFlight-Mail fuer frische Profile.
    setSignupCookie("signup_flow", "1");
    setSignupCookie("login_next", nextPath);

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

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setErrorMessage(null);

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

    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: slug
        ? {
            // handle_new_user Trigger liest das hier und schreibt es als
            // profiles.referred_by_affiliate_id (atomisch im selben INSERT).
            data: { referred_by_affiliate_slug: slug },
          }
        : undefined,
    });

    if (error) {
      // Recovery-Pfad: User hat sich schon registriert (Tab vorher
      // geschlossen) → zu /confirm OHNE neuen Code zu triggern. Sonst
      // kollidieren wir mit dem Supabase-Rate-Limit ("can only request
      // this after N seconds") wenn der Original-Code grade erst
      // rausging. User kann den alten Code probieren; falls abgelaufen
      // → Resend-Button auf /confirm. Status bleibt "submitting" bis
      // die Navigation durch ist (Button bleibt busy, kein Form-Flash).
      if (isUserAlreadyRegistered(error)) {
        writeSignupConfirmHandoff({
          email: cleanEmail,
          variant: "welcome-back",
          next: nextPath,
        });
        router.push("/confirm");
        return;
      }
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Email-Confirmation aktiv → session ist null, User muss den OTP-Code
    // aus der Mail auf /confirm eintippen. Kein Magic-Link, reiner Code.
    // TestFlight-Mail wird ERST nach erfolgreichem verifyOtp rausgeschickt
    // — sonst landen zwei Mails parallel im Postfach (Verification +
    // TestFlight) was verwirrend ist + Typo-Emails kriegen unnoetig
    // TestFlight-Links.
    if (!data.session) {
      writeSignupConfirmHandoff({
        email: cleanEmail,
        variant: "fresh",
        next: nextPath,
      });
      router.push("/confirm");
      return;
    }

    // Auto-confirmed (z.B. dev-Env oder Confirmation off) → TestFlight-Mail
    // jetzt senden, dann weiter zum Ziel-Pfad.
    void sendTestflightInviteMail("SignupForm");
    router.push(nextPath);
  }

  // === Render: Sign-Up ===
  // Die Section-Headline "Make today a Callday." rendern die Landings als
  // h2 UEBER der Card; in der Card sitzt ein kleiner linksbuendiger
  // Titel + Sub (Jan-Decision 2026-07-05 abends, Revert der
  // In-Card-Headline vom Nachmittag).
  // Affiliate-Attribution laeuft komplett im Backend (Trigger / Callback)
  // — Affiliate erscheint nirgendwo auf der Seite (Jan-Decision).
  return (
    <div className="login-card">
      <h3 className="login-card-title">Make today a Callday.</h3>
      <p className="login-card-sub">
        Generate your first call list from Google Maps for free &amp;
        start calling today.
      </p>
      <div className="login-oauth-stack">
        <button
          type="button"
          className="login-oauth-btn login-oauth-btn-apple"
          onClick={() => handleOAuth("apple")}
          disabled={status === "submitting"}
        >
          <AppleIcon />
          <span>Sign up with Apple</span>
        </button>
        <button
          type="button"
          className="login-oauth-btn login-oauth-btn-google"
          onClick={() => handleOAuth("google")}
          disabled={status === "submitting"}
        >
          <GoogleIcon />
          <span>Sign up with Google</span>
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
          {status === "submitting" ? "Signing up..." : "Sign up with Email"}
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
          href={`/login?next=${encodeURIComponent(nextPath)}`}
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
