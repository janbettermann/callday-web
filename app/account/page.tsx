import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { AppNav } from "../components/AppNav";
import { AppShell } from "../components/AppShell";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { parseUserAgent } from "@/lib/user-agent";
import { deleteAccountAction, signOutAction } from "./actions";
import { avatarInitial } from "@/lib/dashboard/data";

export const metadata: Metadata = {
  title: "Your account · Callday",
  description: "Manage your Callday account.",
  robots: { index: false, follow: false },
};

interface Profile {
  email: string | null;
  name: string | null;
  subscription_status: string | null;
  subscription_plan: "monthly" | "yearly" | null;
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
 * /account — schlanke Identitaets-Seite fuer eingeloggte User.
 *
 * Entruempelt 2026-07-24 (Jan-Decision): Lead-Lists-Karte (redundant zu
 * /lists in der Nav), TestFlight-Onboarding-Karte und die Stripe-
 * Subscription-Karte sind raus — Subscriptions laufen ab Launch
 * ausschliesslich ueber Apple-IAP in der App, das Web zeigt nur noch
 * einen read-only Hinweis.
 *
 * Sektionen:
 *   1. Get-the-app: Einzeiler-Karte — einziger In-Product-Zeiger auf die
 *      App (das Dashboard hat keinen). Haelt den Funnel Web-Liste → App
 *      intakt.
 *   2. Account: Email, Sign-in-Methoden, Subscription-Row (read-only,
 *      "managed in the app"), "Delete account" mit Re-Type-Safeguard.
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

  // Beta-Phase: der App-Link zeigt auf den TestFlight-Public-Link (die
  // TestFlight-Landing erklaert Install + Join selbst). Beim App-Store-
  // Launch wird NUR diese eine Konstante auf die App-Store-URL getauscht
  // (https://apps.apple.com/app/id...) — Layout bleibt identisch.
  const appLink = process.env.TESTFLIGHT_PUBLIC_LINK;

  // Device-Kontext: auf Desktop ergaenzt die Karte den "auf dem iPhone
  // oeffnen"-Hinweis.
  const { isIOS } = parseUserAgent((await headers()).get("user-agent"));

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("email,name,subscription_status,subscription_plan")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = profileRow ?? {
    email: user.email ?? null,
    name: null,
    subscription_status: null,
    subscription_plan: null,
  };

  // Read-only Subscription-Label. Die Spalten werden heute von Stripe-
  // Legacy-Daten, ab App-Store-Launch vom RevenueCat-Webhook gefuellt
  // (supabase/functions/revenuecat-webhook im App-Repo) — die Anzeige
  // funktioniert fuer beide Quellen unveraendert.
  // TODO beim App-Store-Launch: Fallback-Label "Beta access" → "Free".
  const hasActiveSubscription =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing";
  const subscriptionLabel = hasActiveSubscription
    ? `Callday ${profile.subscription_plan === "yearly" ? "Yearly" : "Monthly"}`
    : "Beta access";

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
          <h1 className="account-headline">Account</h1>

          {/* Get-the-app — bewusst ein Einzeiler statt der frueheren
              Onboarding-Karte: /account ist der einzige In-Product-Weg
              zur App, mehr als ein Zeiger muss es aber nicht sein. */}
          {appLink && (
            <section
              className="account-card"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 220, flex: 1 }}>
                <h2
                  className="account-card-title"
                  style={{ marginBottom: 4 }}
                >
                  Callday for iPhone
                </h2>
                <p className="account-hint" style={{ margin: 0 }}>
                  Your lists sync to the app — that&apos;s where the calling
                  happens.
                  {!isIOS && " Open this page on your iPhone to install."}
                </p>
              </div>
              <a
                href={appLink}
                className="account-btn account-btn-primary"
                style={{ width: "auto", whiteSpace: "nowrap", marginTop: 0 }}
              >
                Get the app
              </a>
            </section>
          )}

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
            <div className="account-row">
              <span className="account-row-label">Subscription</span>
              <span className="account-row-value">{subscriptionLabel}</span>
            </div>
            <p className="account-hint">
              Your subscription is managed in the Callday app on your iPhone.
            </p>

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
