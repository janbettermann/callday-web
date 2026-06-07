"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * /checkout — Client-Component für den neuen Headspace-style Sign-Up +
 * Plan-Preview-Flow.
 *
 * Layout:
 *   Desktop (≥900px):  2-Spalten-Grid. Links = Preview (Plan-Toggle +
 *                      Plan-Tile + Trial-Timeline + What's-included).
 *                      Rechts = Sign-Up-Form (OAuth + Email/PW).
 *   Mobile  (<900px):  Single-Column mit Step-State.
 *                      Step 1 = Preview + "Start my free trial"-CTA.
 *                      Step 2 = Sign-Up-Form mit Back-Link.
 *                      So sieht der User erst was er kriegt, BEVOR er
 *                      Felder ausfüllen muss — copied from Headspace.
 *
 * Auth-State:
 *   - Unauth: zeigt komplettes Mockup mit Sign-Up-Form rechts.
 *   - Auth (z.B. User kommt von /account): Form fällt weg, Preview bleibt,
 *     CTA wird "Continue to payment" und schickt direkt zum Stripe-
 *     Fast-Path (`/checkout?plan=...` triggert server-side Redirect).
 *
 * Plan-State:
 *   - React-state `plan` steuert was im Plan-Tile + Timeline gezeigt wird.
 *   - Beim Submit (Email/PW oder OAuth) wird der gewählte Plan als
 *     `?plan=` URL-Param mitgegeben — entweder über `login_next`-Cookie
 *     (OAuth) oder direkten `router.push` (Email/PW post-signup).
 *
 * Pricing kommt vom Server (computed mit/ohne Founder-Code), damit der
 * Client keine eigene Discount-Math machen muss.
 */

type PlanKey = "yearly" | "monthly";
type MobileStep = "preview" | "form";
type Status = "idle" | "submitting" | "error";

export interface PriceTiles {
  yearly: { total: string; perMonth: string };
  monthly: { perMonth: string };
}

export interface CheckoutClientProps {
  code: string | null;
  hasDiscount: boolean;
  prices: PriceTiles;
  /** Wenn User schon eingeloggt: Email anzeigen + Form weglassen. */
  authedEmail: string | null;
}

export function CheckoutClient({
  code,
  hasDiscount,
  prices,
  authedEmail,
}: CheckoutClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanKey>("yearly");
  const [mobileStep, setMobileStep] = useState<MobileStep>("preview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [wantUpdates, setWantUpdates] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function buildNextUrl(targetPlan: PlanKey): string {
    const params = new URLSearchParams();
    params.set("plan", targetPlan);
    if (code) params.set("code", code);
    return `/checkout?${params.toString()}`;
  }

  function setLoginNextCookie(targetPlan: PlanKey) {
    if (typeof document === "undefined") return;
    const value = encodeURIComponent(buildNextUrl(targetPlan));
    document.cookie = `login_next=${value}; path=/; max-age=600; samesite=lax`;
  }

  async function handleOAuth(provider: "apple" | "google") {
    if (status === "submitting") return;
    setErrorMessage(null);
    setStatus("submitting");
    setLoginNextCookie(plan);

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
    // signInWithOAuth navigates browser away — kein router.push nötig.
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      status === "submitting" ||
      !email ||
      !password ||
      !acceptTerms
    ) {
      return;
    }
    setErrorMessage(null);
    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    const cleanEmail = email.trim();
    const next = buildNextUrl(plan);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        // Updates-Präferenz als user_metadata speichern. Optional, wird
        // später für Email-Marketing-Opt-In abgefragt.
        data: { wants_updates: wantUpdates },
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    if (!data.session) {
      // Email-Confirmation aktiv: User braucht 8-stelligen Code aus der
      // Mail. Wir leiten zum existierenden /login OTP-Step weiter mit
      // `next`-Preserved damit Post-Confirm direkt im Stripe-Flow landet.
      const otpParams = new URLSearchParams();
      otpParams.set("mode", "otp-code");
      otpParams.set("next", next);
      otpParams.set("email", cleanEmail);
      router.push(`/login?${otpParams.toString()}`);
      return;
    }

    // Session da → Auth steht. Push zum Fast-Path-Plan-URL, der
    // server-side direkt zu Stripe redirected.
    router.push(next);
  }

  return (
    <div className="checkout-grid" data-mobile-step={mobileStep}>
      <div className="checkout-grid-preview">
        <CheckoutPreview
          plan={plan}
          setPlan={setPlan}
          hasDiscount={hasDiscount}
          code={code}
          prices={prices}
          authedEmail={authedEmail}
          onMobileContinue={
            authedEmail ? undefined : () => setMobileStep("form")
          }
          authedNextHref={authedEmail ? buildNextUrl(plan) : null}
        />
      </div>

      {/* Sign-Up-Form-Spalte — fällt bei eingeloggten Usern weg. */}
      {!authedEmail && (
        <div className="checkout-grid-form">
          <button
            type="button"
            className="checkout-mobile-back"
            onClick={() => setMobileStep("preview")}
          >
            ← Back to plan
          </button>

          <div className="login-card checkout-signup-card">
            <h2 className="login-headline">Sign up</h2>
            <p className="login-sub">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(buildNextUrl(plan))}`}
                className="login-text-link login-text-link-strong"
              >
                Log in
              </Link>
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
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={status === "submitting"}
                />
              </label>

              <label className="checkout-checkbox">
                <input
                  type="checkbox"
                  checked={wantUpdates}
                  onChange={(e) => setWantUpdates(e.target.checked)}
                />
                <span>
                  Email me launch progress and founder pricing updates
                  (optional).
                </span>
              </label>

              <label className="checkout-checkbox">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to Callday&apos;s{" "}
                  <Link href="/terms">Terms &amp; Conditions</Link> and
                  acknowledge the <Link href="/privacy">Privacy Policy</Link>.
                </span>
              </label>

              <button
                type="submit"
                className="beta-submit"
                disabled={
                  !email ||
                  !password ||
                  !acceptTerms ||
                  status === "submitting"
                }
              >
                {status === "submitting"
                  ? "Creating account..."
                  : "Create account & start trial"}
              </button>

              {errorMessage && (
                <p className="beta-submit-error" role="alert">
                  {errorMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Preview-Spalte (Plan + Timeline + What's-included). Wird sowohl im
// Unauth-2-Col als auch im Auth-Single-Col-Fall benutzt.
// =========================================================================

interface CheckoutPreviewProps {
  plan: PlanKey;
  setPlan: (next: PlanKey) => void;
  hasDiscount: boolean;
  code: string | null;
  prices: PriceTiles;
  authedEmail: string | null;
  /** Mobile-Only: wenn gesetzt, rendert "Start my free trial"-CTA für
   *  Step-Switch. Bei Auth-Variante: undefined (kein Step-Switch nötig). */
  onMobileContinue?: () => void;
  /** Auth-Only: wenn gesetzt, rendert "Continue to payment" als Link
   *  zum Stripe-Fast-Path. */
  authedNextHref: string | null;
}

function CheckoutPreview({
  plan,
  setPlan,
  hasDiscount,
  code,
  prices,
  authedEmail,
  onMobileContinue,
  authedNextHref,
}: CheckoutPreviewProps) {
  const planPriceTotal =
    plan === "yearly" ? prices.yearly.total : prices.monthly.perMonth;
  const planPriceSub =
    plan === "yearly"
      ? `${prices.yearly.total}/year (${prices.yearly.perMonth}/mo)`
      : `${prices.monthly.perMonth}/month`;
  const trialEndCharge =
    plan === "yearly" ? prices.yearly.total : prices.monthly.perMonth;

  return (
    <>
      {hasDiscount && code && (
        <div className="checkout-discount-notice">
          <span className="checkout-discount-notice-label">
            Founder pricing applied
          </span>
          <span className="checkout-discount-notice-code">{code}</span>
        </div>
      )}

      <h1 className="checkout-trial-headline">
        Get the full Callday
        <br />
        experience for{" "}
        <span className="checkout-trial-zero">€0 today</span>
      </h1>

      {authedEmail && (
        <p className="checkout-trial-authed-note">
          You&apos;re signed in as <strong>{authedEmail}</strong>
        </p>
      )}

      {/* Plan-Toggle Pill (Annual / Monthly) */}
      <div
        className="plan-toggle"
        role="radiogroup"
        aria-label="Choose a plan"
      >
        <button
          type="button"
          role="radio"
          aria-checked={plan === "yearly"}
          className={`plan-toggle-btn ${
            plan === "yearly" ? "plan-toggle-btn-active" : ""
          }`}
          onClick={() => setPlan("yearly")}
        >
          Annual
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={plan === "monthly"}
          className={`plan-toggle-btn ${
            plan === "monthly" ? "plan-toggle-btn-active" : ""
          }`}
          onClick={() => setPlan("monthly")}
        >
          Monthly
        </button>
      </div>

      {/* Plan-Tile mit €0 today Highlight */}
      <div
        className={`trial-card ${
          plan === "yearly" ? "trial-card-best" : ""
        }`}
      >
        {plan === "yearly" && (
          <div className="trial-card-badge">BEST VALUE</div>
        )}
        <div className="trial-card-row">
          <div>
            <div className="trial-card-name">
              {plan === "yearly" ? "Annual" : "Monthly"}
            </div>
            <div className="trial-card-sub">{planPriceSub}</div>
          </div>
          <div className="trial-card-zero">
            <div className="trial-card-zero-amount">€0.00</div>
            <div className="trial-card-zero-window">for 7 days</div>
          </div>
        </div>
      </div>

      <div className="trial-explainer">
        <div className="trial-explainer-title">How your free trial works</div>
        <div className="trial-explainer-body">
          7 days free, then {planPriceTotal}
          {plan === "yearly"
            ? ` (~${prices.yearly.perMonth}/mo)`
            : "/month"}
          .{" "}
          <a href="#" className="trial-explainer-cancel">
            Cancel anytime before.
          </a>
        </div>
      </div>

      <ol className="trial-timeline">
        <li className="trial-timeline-item">
          <div className="trial-timeline-icon trial-timeline-icon-today">
            <LockIcon />
          </div>
          <div className="trial-timeline-body">
            <div className="trial-timeline-when">Today</div>
            <div className="trial-timeline-what">
              Pay €0 today. Start dialing with one tap, one card at a time.
            </div>
          </div>
        </li>
        <li className="trial-timeline-item">
          <div className="trial-timeline-icon trial-timeline-icon-mid">
            <BellIcon />
          </div>
          <div className="trial-timeline-body">
            <div className="trial-timeline-when">In 5 days</div>
            <div className="trial-timeline-what">
              We&apos;ll email you a reminder that your trial is ending soon.
            </div>
          </div>
        </li>
        <li className="trial-timeline-item">
          <div className="trial-timeline-icon trial-timeline-icon-end">
            <SunIcon />
          </div>
          <div className="trial-timeline-body">
            <div className="trial-timeline-when">In 7 days</div>
            <div className="trial-timeline-what">
              You&apos;ll be charged {trialEndCharge}, or cancel anytime
              before.
            </div>
          </div>
        </li>
      </ol>

      <div className="included-section">
        <div className="included-title">What&apos;s included</div>
        <ul className="included-list">
          <li>
            <CheckBulletIcon />
            <span>
              One card at a time — tap to call, tap to log, next lead slides
              in
            </span>
          </li>
          <li>
            <CheckBulletIcon />
            <span>
              Every dial counts — voicemails, &quot;not interested&quot;, all
              tracked
            </span>
          </li>
          <li>
            <CheckBulletIcon />
            <span>
              Booked meetings fire calendar event + confirmation email
              automatically
            </span>
          </li>
          <li>
            <CheckBulletIcon />
            <span>
              No CRM. No spreadsheet. Your phone is the whole system.
            </span>
          </li>
        </ul>
      </div>

      {/* Mobile-Only Step-Switch-CTA (Unauth-Path) */}
      {onMobileContinue && (
        <button
          type="button"
          className="checkout-mobile-cta"
          onClick={onMobileContinue}
        >
          Start my free trial
        </button>
      )}

      {/* Auth-Only Stripe-Fast-Path-CTA */}
      {authedNextHref && (
        <Link href={authedNextHref} className="checkout-authed-cta">
          Continue to payment
        </Link>
      )}
    </>
  );
}

// =========================================================================
// Icons — inline SVG, klein gehalten damit kein zusätzliches Lib gebraucht
// wird. Apple + Google sind 1:1 von /login geklaut (siehe app/login/page.tsx).
// =========================================================================

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

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function CheckBulletIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
