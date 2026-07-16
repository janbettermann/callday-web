import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { AppNav } from "../components/AppNav";
import { AppShell } from "../components/AppShell";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { parseUserAgent } from "@/lib/user-agent";
import {
  createPortalSessionAction,
  deleteAccountAction,
  signOutAction,
} from "./actions";
import { ResendTestFlightButton } from "./ResendTestFlightButton";
import { LeadListsSection } from "./LeadListsSection";
import { avatarInitial } from "@/lib/dashboard/data";

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
  referred_by_affiliate_id: string | null;
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
 * Sektionen:
 *   1. Install/Onboarding: "You're in" + TestFlight-2-Step + Resend.
 *      Immer sichtbar — deckt Erst-Signup UND Reinstall (neues Handy) ab.
 *   2. Subscription: Status + Plan + Renewal, "Manage subscription" Button
 *      (öffnet Stripe Customer Portal via Server Action).
 *   3. Account: Email, Sign-in-Methoden, "Delete account" mit Re-Type-Safeguard.
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

  const testflightLink = process.env.TESTFLIGHT_PUBLIC_LINK;
  // TestFlight-App im App Store — fixe Apple-App-ID, global konstant.
  const testflightAppStoreUrl =
    "https://apps.apple.com/app/testflight/id899247664";

  // Device-Kontext fuer den Welcome-State (Desktop -> "auf iPhone weitermachen").
  const { isIOS } = parseUserAgent((await headers()).get("user-agent"));

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "email,name,stripe_customer_id,subscription_status,subscription_plan,subscription_renews_at,referred_by_affiliate_id",
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
    referred_by_affiliate_id: null,
  };

  // Nur echte Namen (kommen von Apple/Google-OAuth). Email-Signups haben
  // keinen Namen — dann NICHT den Email-Localpart als "Name" zeigen (sah aus
  // wie "Hi jan.bettermann11+628."), sondern ein generisches Welcome.
  const firstName = profile.name?.trim().split(/\s+/)[0] || null;

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
    <AppShell>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <AppNav
        active="account"
        initial={avatarInitial(profile.name, profile.email)}
      />

      <main className="account-page">
        <div className="account-inner">
          <h1 className="account-headline">
            {firstName
              ? `Welcome to the beta, ${firstName}.`
              : "Welcome to the beta"}
          </h1>
          <p className="account-sub">You call. Callday handles the rest.</p>

          {/* Lead-Listen: kompakter Zeiger auf die Listen-Welt (/lists +
              /lists/new) — Promo/Status/Zeile je nach Zustand, siehe
              LeadListsSection. Bewusst VOR der TestFlight-Card:
              Schritt 1 Liste, Schritt 2 App. */}
          <LeadListsSection userId={user.id} />

          {/* Install-/Onboarding-Card — immer sichtbar: direkt nach dem Signup
              UND wenn ein Rueckkehrer (neues Handy) die App neu laden muss. */}
          {testflightLink && (
            <section
              className="account-card"
              style={{
                borderColor: "rgba(37,99,232,0.3)",
                background:
                  "linear-gradient(180deg, rgba(37,99,232,0.06) 0%, rgba(255,255,255,1) 100%)",
              }}
            >
              <h2 className="account-card-title account-welcome-title">
                You&apos;re in 🎉
              </h2>
              <p className="account-welcome-lede">
                Your first calls are one install away.
              </p>

              <ol className="account-steps">
                <li className="account-step">
                  <span className="account-step-num">1</span>
                  <span className="account-step-text">
                    Install <strong>TestFlight</strong> — Apple&apos;s free
                    beta app
                  </span>
                </li>
                <li className="account-step">
                  <span className="account-step-num">2</span>
                  <span className="account-step-text">
                    Unlock Callday inside TestFlight
                  </span>
                </li>
                <li className="account-step">
                  <span className="account-step-num">3</span>
                  <span className="account-step-text">
                    Sign in with{" "}
                    {profile.email ? (
                      <span className="account-step-email">
                        {profile.email}
                      </span>
                    ) : (
                      "the same email"
                    )}{" "}
                    and start calling
                  </span>
                </li>
              </ol>

              {!isIOS && (
                <p className="account-hint account-welcome-device">
                  TestFlight runs on iPhone — open this page (or the email we
                  sent) on your iPhone to continue.
                </p>
              )}

              <div className="account-welcome-actions">
                <a
                  href={testflightAppStoreUrl}
                  className="account-btn account-btn-secondary"
                >
                  Install TestFlight
                </a>
                <a
                  href={testflightLink}
                  className="account-btn account-btn-primary"
                >
                  Unlock Callday
                </a>
              </div>

              <p className="account-hint">
                We also send an invite email, but the buttons above are all you
                need. No need to dig through your inbox.{" "}
                {profile.email ? (
                  <ResendTestFlightButton />
                ) : (
                  "Email missing on your profile — contact hello@callday.io."
                )}
              </p>
            </section>
          )}

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
                  Beta access
                </div>
                <p className="account-body">
                  You&apos;re in the closed beta. Pricing and subscriptions
                  go live at public launch — we&apos;ll email you when
                  it&apos;s time. Until then, enjoy unlimited use.
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

          <form action={signOutAction}>
            <button type="submit" className="account-signout-link">
              Sign out
            </button>
          </form>

          {/* Legal — dezent am Fuss der Account-Seite. Seit dem Footer-
              Wegfall (Jan 2026-07-17) die einzige Legal-Erreichbarkeit im
              eingeloggten Bereich; ueber die Avatar-Pille von jeder Seite
              1 Klick entfernt (Impressumspflicht). */}
          <nav className="account-legal" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </nav>
        </div>
      </main>
    </AppShell>
  );
}
