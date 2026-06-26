import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import {
  createPortalSessionAction,
  deleteAccountAction,
  signOutAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Your account · Callday",
  description: "Manage your Callday subscription and account.",
  robots: { index: false, follow: false },
};

interface Profile {
  email: string | null;
  name: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  subscription_plan: "monthly" | "yearly" | null;
  subscription_renews_at: string | null;
}

/**
 * Human-readable label fuer einen Auth-Provider-Slug. Supabase gibt
 * `'email'` fuer Email/Password und Magic-Link/OTP-Login zurueck —
 * beide faellt der User-facing als "Email" weil er den Unterschied
 * (Password vs OTP-Code) selbst nicht mehr explizit kennt.
 */
function providerLabel(provider: string): string {
  switch (provider) {
    case "apple":
      return "Apple";
    case "google":
      return "Google";
    case "email":
      return "Email";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

/**
 * Alle Provider die mit diesem User verknuepft sind, deduped und in
 * stabiler Reihenfolge. Supabase linkt Identities automatisch wenn
 * Email-Match + verified — `user.app_metadata.provider` zeigt nur den
 * ORIGINAL-Provider, `identities[]` zeigt alle. Wir zeigen alle damit
 * der User weiss womit er sich (auch) einloggen kann.
 */
function linkedProviders(
  identities:
    | Array<{ provider?: string | null }>
    | null
    | undefined,
): string[] {
  if (!identities) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of identities) {
    const p = id.provider;
    if (p && !seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

/**
 * /account — Self-Service Hub für eingeloggte User.
 *
 * Drei Sektionen:
 *   1. Subscription: Status + Plan + Renewal, "Manage subscription" Button
 *      (öffnet Stripe Customer Portal via Server Action).
 *   2. Account: Email, "Delete account" Form mit Email-Re-Type-Safeguard.
 *   3. Mobile: App-Store-Link + Open-App-Hint.
 *
 * Auth-Gate: nicht-eingeloggte User werden zu /login?next=/account
 * geschickt. Per @supabase/ssr-Middleware werden Cookies vorher refreshed.
 */
export default async function AccountPage() {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "email,name,stripe_customer_id,subscription_status,subscription_plan,subscription_renews_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = profileRow ?? {
    email: user.email ?? null,
    name: null,
    stripe_customer_id: null,
    subscription_status: null,
    subscription_plan: null,
    subscription_renews_at: null,
  };

  const firstName =
    profile.name?.trim().split(/\s+/)[0] ||
    profile.email?.split("@")[0] ||
    "there";

  const hasActiveSubscription =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing";

  const isPaused = profile.subscription_status === "paused";
  const isCanceled = profile.subscription_status === "canceled";

  const renewsDate = profile.subscription_renews_at
    ? new Date(profile.subscription_renews_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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

      <main className="account-page">
        <div className="account-inner">
          <h1 className="account-headline">Hi {firstName}.</h1>
          <p className="account-sub">Manage your subscription and account.</p>

          {/* Subscription Section */}
          <section className="account-card">
            <h2 className="account-card-title">Subscription</h2>

            {hasActiveSubscription && (
              <>
                <div className="account-status account-status-active">
                  <span className="account-status-dot" />
                  Active
                </div>
                <div className="account-row">
                  <span className="account-row-label">Plan</span>
                  <span className="account-row-value">
                    Callday {profile.subscription_plan === "yearly"
                      ? "Yearly"
                      : "Monthly"}
                  </span>
                </div>
                {renewsDate && (
                  <div className="account-row">
                    <span className="account-row-label">Renews</span>
                    <span className="account-row-value">{renewsDate}</span>
                  </div>
                )}
                <form action={createPortalSessionAction}>
                  <button type="submit" className="account-btn account-btn-primary">
                    Manage subscription
                  </button>
                </form>
                <p className="account-hint">
                  Update payment method, change plan, cancel or pause — all
                  via Stripe.
                </p>
              </>
            )}

            {isPaused && (
              <>
                <div className="account-status account-status-paused">
                  Paused
                </div>
                <p className="account-body">
                  Your subscription is paused. You can resume anytime.
                </p>
                <form action={createPortalSessionAction}>
                  <button type="submit" className="account-btn account-btn-primary">
                    Resume subscription
                  </button>
                </form>
              </>
            )}

            {isCanceled && (
              <>
                <div className="account-status account-status-canceled">
                  Cancelled
                </div>
                <p className="account-body">
                  Your subscription was cancelled
                  {renewsDate && (
                    <>
                      {" "}
                      and ends on <strong>{renewsDate}</strong>
                    </>
                  )}
                  . You can resubscribe anytime.
                </p>
                {profile.stripe_customer_id && (
                  <form action={createPortalSessionAction}>
                    <button type="submit" className="account-btn account-btn-primary">
                      Open billing portal
                    </button>
                  </form>
                )}
              </>
            )}

            {!hasActiveSubscription && !isPaused && !isCanceled && (
              <>
                <div className="account-status account-status-none">
                  No active subscription
                </div>
                <p className="account-body">
                  Subscribe to Callday Pro to unlock unlimited lead lists,
                  built-in calendar, and automatic meeting confirmations.
                  Cancel or pause anytime.
                </p>
                <Link
                  href="/checkout"
                  className="account-btn account-btn-primary"
                >
                  Subscribe to Callday Pro
                </Link>
                <p className="account-hint">
                  Have a founder code? Use the link from your Callday
                  email — it applies your discount automatically.
                </p>
              </>
            )}
          </section>

          {/* Account Section */}
          <section className="account-card">
            <h2 className="account-card-title">Account</h2>
            <div className="account-row">
              <span className="account-row-label">Email</span>
              <span className="account-row-value">{profile.email}</span>
            </div>
            <div className="account-row">
              <span className="account-row-label">Sign-in methods</span>
              <span className="account-row-value">
                {(() => {
                  const providers = linkedProviders(user.identities);
                  if (providers.length === 0) return "Email";
                  return providers.map(providerLabel).join(" · ");
                })()}
              </span>
            </div>

            <details className="account-details">
              <summary className="account-details-summary">
                Delete account
              </summary>
              <div className="account-details-content">
                <p className="account-body">
                  This permanently deletes your account and all data. Any
                  active subscription is cancelled automatically. To
                  confirm, type your email below.
                </p>
                <form action={deleteAccountAction} className="account-delete-form">
                  <input
                    type="email"
                    name="confirm_email"
                    required
                    placeholder={profile.email ?? "your@email.com"}
                    className="account-input"
                    autoComplete="off"
                  />
                  <button type="submit" className="account-btn account-btn-danger">
                    Delete my account
                  </button>
                </form>
              </div>
            </details>
          </section>

          {/* Mobile App Section */}
          <section className="account-card">
            <h2 className="account-card-title">Callday on iPhone</h2>
            <p className="account-body">
              Open Callday on your iPhone and sign in with the same email.
              Your subscription is already active.
            </p>
            {/* TODO: replace with real App Store URL once approved */}
            <a
              href="https://apps.apple.com/"
              className="account-btn account-btn-secondary"
            >
              Open App Store
            </a>
          </section>

          <form action={signOutAction}>
            <button type="submit" className="account-signout-link">
              Sign out
            </button>
          </form>
        </div>
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
