import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getStripe } from "@/lib/stripe";
import { CheckoutClient, type PriceTiles } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Get Callday · 7-day free trial",
  description:
    "Start your 7-day free trial. €0 today, cancel anytime before charge.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ code?: string; plan?: string }>;
}

/**
 * Erstellt eine Stripe-Checkout-Session und gibt die Redirect-URL zurück.
 * Wird vom direct-skip-Pfad (?plan= im URL) UND vom Post-Signup-Redirect
 * benutzt — single source of truth.
 */
async function createCheckoutSession(args: {
  plan: "monthly" | "yearly";
  code: string | null;
  promotionCodeId: string | null;
  userId: string;
  userEmail: string | null;
}): Promise<string> {
  const { plan, code, promotionCodeId, userId, userEmail } = args;

  const priceId =
    plan === "monthly"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;
  if (!priceId) {
    throw new Error(`Price ID for plan "${plan}" is not configured`);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://callday.io";

  const baseMetadata: Record<string, string> = {
    callday_user_id: userId,
    callday_plan: plan,
  };
  if (code) {
    baseMetadata.callday_code = code;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(promotionCodeId
      ? { discounts: [{ promotion_code: promotionCodeId }] }
      : {}),
    client_reference_id: userId,
    customer_email: userEmail ?? undefined,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    // cancel_url führt zurück zur Checkout-Page (ohne ?plan=) damit der
    // User bei Stripe-Abort nicht in einer Endlos-Redirect-Schleife landet.
    cancel_url: code
      ? `${baseUrl}/checkout?code=${encodeURIComponent(code)}`
      : `${baseUrl}/checkout`,
    metadata: baseMetadata,
    subscription_data: {
      metadata: baseMetadata,
    },
  });

  if (!session.url) {
    throw new Error("Stripe didn't return a checkout URL");
  }

  return session.url;
}

/**
 * /checkout — die zentrale Subscription-Start-Page.
 *
 * Drei Modi in einer Page, abhängig von URL + Auth-State:
 *
 *   1. ?plan=monthly|yearly + auth'd  → Direct-Stripe-Skip (server-side
 *      Redirect zu Stripe-hosted Checkout). Vom Landing-CTA + Post-Signup-
 *      Redirect benutzt.
 *
 *   2. Unauth (mit oder ohne ?plan=, mit oder ohne ?code=) → CheckoutClient
 *      rendert das volle Sign-Up + Plan-Preview-Layout (Headspace-style).
 *      Nach Sign-Up wird via Client-Side router.push zum Fast-Path-Modus 1
 *      gewechselt.
 *
 *   3. Auth ohne ?plan= → CheckoutClient mit eingeloggtem User-Hint und
 *      "Continue to payment"-CTA statt Sign-Up-Form. Praktisch z.B. wenn
 *      ein User via /account zur Subscription kommt.
 *
 * Founder-Code (?code=CALLDAY-X):
 *   - Wird gegen Stripe Promotion-Codes validiert.
 *   - Bei ungültigem/abgelaufenem Code zeigen wir explizit eine Fehler-
 *     Page statt den Standard-Flow — wir wollen nicht dass der User mit
 *     kaputtem Code dann versehentlich Vollpreis zahlt.
 *   - Bei gültigem Code: discounted Preise (50% off) werden im Mockup
 *     angezeigt + Founder-Pricing-Banner über der Headline.
 */
export default async function CheckoutPage({ searchParams }: PageProps) {
  const { code, plan: planParam } = await searchParams;

  // 1) Auth-State lesen (kein Hard-Redirect mehr — die neue Page handled
  //    Unauth selbst über die Sign-Up-Form rechts).
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2) Code-Validierung (nur wenn ?code= mitgegeben)
  let promotionCodeId: string | null = null;
  if (code) {
    const stripe = getStripe();
    try {
      const list = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      if (list.data.length > 0) {
        promotionCodeId = list.data[0].id;
      }
    } catch (err) {
      console.error("[/checkout] Stripe code lookup failed", err);
      return (
        <CheckoutShell>
          <div className="checkout-inner">
            <h1 className="checkout-headline">
              Couldn&apos;t verify your code
            </h1>
            <p className="checkout-body">
              Something went wrong on our end while checking the code. Try
              again in a minute, or reach out at{" "}
              <a href="mailto:hello@callday.io">hello@callday.io</a> and
              we&apos;ll take a look.
            </p>
          </div>
        </CheckoutShell>
      );
    }

    if (!promotionCodeId) {
      return (
        <CheckoutShell>
          <div className="checkout-inner">
            <h1 className="checkout-headline">This code isn&apos;t active</h1>
            <p className="checkout-body">
              The founder code <strong>{code}</strong> is either expired,
              already used, or doesn&apos;t exist. If you think this is a
              mistake, reply to the Callday email you got, or contact{" "}
              <a href="mailto:hello@callday.io">hello@callday.io</a>.
            </p>
            <p className="checkout-body">
              Or you can{" "}
              <Link
                href="/checkout"
                style={{ color: "var(--blue)", textDecoration: "underline" }}
              >
                subscribe at the regular price
              </Link>
              .
            </p>
          </div>
        </CheckoutShell>
      );
    }
  }

  const hasDiscount = promotionCodeId !== null;

  // 3) Direct-Stripe-Skip: ?plan= + auth'd → fast-path direkt zu Stripe.
  //    Unauth + ?plan= → Client rendert Mockup mit pre-selected Plan; nach
  //    Sign-Up routet er sich selbst zurück hierher mit derselben URL und
  //    triggert dann diesen Skip.
  if (user && (planParam === "yearly" || planParam === "monthly")) {
    const url = await createCheckoutSession({
      plan: planParam,
      code: code ?? null,
      promotionCodeId,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    redirect(url);
  }

  // 4) Pricing-Tiles computen (mit/ohne Discount). Hard-coded statt
  //    aus Stripe gezogen — Display-Werte ändern sich nicht oft und
  //    sparen einen extra API-Call pro Page-Load. Bei Pricing-Pivots
  //    hier UND die Stripe-Products anpassen.
  const prices: PriceTiles = hasDiscount
    ? {
        yearly: { total: "€99.50", perMonth: "€8.29" },
        monthly: { perMonth: "€12.50" },
      }
    : {
        yearly: { total: "€199", perMonth: "€16.58" },
        monthly: { perMonth: "€24.99" },
      };

  return (
    <CheckoutShell>
      <CheckoutClient
        code={code ?? null}
        hasDiscount={hasDiscount}
        prices={prices}
        authedEmail={user?.email ?? null}
      />
    </CheckoutShell>
  );
}

// ---- Shared layout-shell für die Checkout-Page (Status + Error) ----
function CheckoutShell({ children }: { children: React.ReactNode }) {
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

      <main className="checkout-page">{children}</main>

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
