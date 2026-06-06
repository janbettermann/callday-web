import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Activate your founder pricing · Callday",
  description: "Pick a plan and lock in your founder code.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

/**
 * /checkout?code=CALLDAY-XYZ
 *
 * Server Component — drei Pflicht-Gates bevor wir zu Stripe weiterleiten:
 *
 *   1. Code-Param vorhanden? Sonst Fehler-State.
 *   2. User eingeloggt? Sonst Redirect /login?next=/checkout?code=...
 *   3. Code in Stripe gültig + active? Sonst Fehler-State.
 *
 * Wenn alle drei stimmen, rendern wir den Plan-Picker. Der eigentliche
 * Stripe-Checkout-Session-Create läuft per Server Action im Picker-Form.
 *
 * Wir machen den Session-Create NICHT direkt in dieser Page weil der
 * User noch Monthly vs Yearly wählen soll — die Wahl muss vor dem
 * Session-Create stehen, sonst kann er sie nicht mehr ändern.
 */
export default async function CheckoutPage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <CheckoutShell>
        <h1 className="checkout-headline">Missing your founder code</h1>
        <p className="checkout-body">
          This page needs a founder code in the URL. If you came here from a
          Callday email, the link should include it automatically — try
          clicking the original link again, or reach out at{" "}
          <a href="mailto:hello@callday.io">hello@callday.io</a>.
        </p>
      </CheckoutShell>
    );
  }

  // Gate 2 — Auth check
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/checkout?code=${encodeURIComponent(code)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // Gate 3 — Code validation via Stripe
  const stripe = getStripe();
  let promotionCodeId: string | null = null;
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
        <h1 className="checkout-headline">Couldn&apos;t verify your code</h1>
        <p className="checkout-body">
          Something went wrong on our end while checking the code. Try
          again in a minute, or reach out at{" "}
          <a href="mailto:hello@callday.io">hello@callday.io</a> and
          we&apos;ll take a look.
        </p>
      </CheckoutShell>
    );
  }

  if (!promotionCodeId) {
    return (
      <CheckoutShell>
        <h1 className="checkout-headline">This code isn&apos;t active</h1>
        <p className="checkout-body">
          The founder code <strong>{code}</strong> is either expired,
          already used, or doesn&apos;t exist. If you think this is a
          mistake, reply to the Callday email you got, or contact{" "}
          <a href="mailto:hello@callday.io">hello@callday.io</a>.
        </p>
      </CheckoutShell>
    );
  }

  // All gates passed — render plan picker
  return (
    <CheckoutShell>
      <h1 className="checkout-headline">Activate your founder pricing</h1>
      <p className="checkout-body">
        Pick a plan and lock in 50% off Callday for life, plus your first
        month free. Your code{" "}
        <strong className="checkout-code">{code}</strong> is applied
        automatically.
      </p>

      <div className="checkout-plans">
        <form action={startCheckoutAction}>
          <input type="hidden" name="plan" value="yearly" />
          <input type="hidden" name="code" value={code} />
          <input
            type="hidden"
            name="promotionCodeId"
            value={promotionCodeId}
          />
          <button type="submit" className="checkout-plan checkout-plan-best">
            <span className="checkout-plan-badge">Best value</span>
            <span className="checkout-plan-name">Yearly</span>
            <span className="checkout-plan-price">€99.50/year</span>
            <span className="checkout-plan-note">
              50% off €199 · billed once per year · first month free
            </span>
          </button>
        </form>

        <form action={startCheckoutAction}>
          <input type="hidden" name="plan" value="monthly" />
          <input type="hidden" name="code" value={code} />
          <input
            type="hidden"
            name="promotionCodeId"
            value={promotionCodeId}
          />
          <button type="submit" className="checkout-plan">
            <span className="checkout-plan-name">Monthly</span>
            <span className="checkout-plan-price">€12.50/month</span>
            <span className="checkout-plan-note">
              50% off €24.99 · first month free
            </span>
          </button>
        </form>
      </div>

      <p className="checkout-meta">
        You can cancel or pause anytime from your account. Payment via
        Stripe — we never see your card.
      </p>
    </CheckoutShell>
  );
}

// ---- Server Action: Stripe-Checkout-Session erstellen + redirecten ----
async function startCheckoutAction(formData: FormData) {
  "use server";

  const plan = formData.get("plan");
  const code = formData.get("code");
  const promotionCodeId = formData.get("promotionCodeId");

  if (
    typeof plan !== "string" ||
    typeof code !== "string" ||
    typeof promotionCodeId !== "string"
  ) {
    throw new Error("invalid form data");
  }
  if (plan !== "monthly" && plan !== "yearly") {
    throw new Error("invalid plan");
  }

  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const priceId =
    plan === "monthly"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;
  if (!priceId) {
    throw new Error(`Price ID for plan "${plan}" is not configured`);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://callday.io";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: [{ promotion_code: promotionCodeId }],
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout?code=${encodeURIComponent(code)}`,
    metadata: {
      callday_user_id: user.id,
      callday_plan: plan,
      callday_code: code,
    },
    subscription_data: {
      metadata: {
        callday_user_id: user.id,
        callday_plan: plan,
        callday_code: code,
      },
    },
    // allow_promotion_codes NICHT setzen — schließt sich per Stripe-API
    // mit discounts gegenseitig aus. Default-Verhalten (kein Promo-Code-
    // Feld in Stripe-Checkout) ist eh was wir wollen, weil der User den
    // Founder-Code bereits via URL hatte und wir ihn pre-applied haben.
  });

  if (!session.url) {
    throw new Error("Stripe didn't return a checkout URL");
  }

  redirect(session.url);
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

      <main className="checkout-page">
        <div className="checkout-inner">{children}</div>
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
