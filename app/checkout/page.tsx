import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../components/CalldayLogo";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Subscribe to Callday Pro · Callday",
  description: "Pick a plan and start dialing.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ code?: string; plan?: string }>;
}

/**
 * Erstellt eine Stripe-Checkout-Session und gibt die Redirect-URL zurück.
 * Wird vom direct-skip-Pfad (?plan= im URL) UND vom Form-Action des
 * Plan-Pickers benutzt — single source of truth.
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
    // cancel_url führt zum Plan-Picker (ohne ?plan=) damit der User bei
    // Stripe-Abort nicht in einer Endlos-Redirect-Schleife landet.
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
 * /checkout — zwei Varianten in einer Page:
 *
 *   /checkout                 → Vollpreis-Pfad (Public-Launch + ab /account)
 *                               €24.99/mo oder €199/yr, kein Discount.
 *   /checkout?code=CALLDAY-X  → Founder-Code-Pfad (Launch-Day-Emails)
 *                               50% off + first month free, Code locked in.
 *
 * Auth-Gate vorgeschaltet: nicht-eingeloggte User landen auf
 * /login?next=/checkout?code=... (oder /login?next=/checkout ohne Code).
 *
 * Bei vorhandenem Code wird er gegen Stripe Promotion-Codes validiert.
 * Bei ungültigem/abgelaufenem Code zeigen wir einen Fehler-State statt
 * den Picker — wir wollen nicht dass ein User mit kaputtem Code dann
 * versehentlich Vollpreis zahlt.
 */
export default async function CheckoutPage({ searchParams }: PageProps) {
  const { code, plan: planParam } = await searchParams;

  // Gate 1 — Auth check
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // next-URL preserved beide Params damit nach Login direkt weiter geht
    const params = new URLSearchParams();
    if (code) params.set("code", code);
    if (planParam) params.set("plan", planParam);
    const qs = params.toString();
    const next = qs ? `/checkout?${qs}` : "/checkout";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // Gate 2 — Code validation (NUR wenn Code mitgegeben)
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
        </CheckoutShell>
      );
    }
  }

  const hasDiscount = promotionCodeId !== null;

  // DIRECT-SKIP: wenn ?plan= in der URL ist (z.B. vom Landing-CTA),
  // erstellen wir die Stripe-Session direkt + redirecten. Picker wird
  // übersprungen — User klickt sich nicht zweimal durch den selben Plan.
  if (planParam === "yearly" || planParam === "monthly") {
    const url = await createCheckoutSession({
      plan: planParam,
      code: code ?? null,
      promotionCodeId,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    redirect(url);
  }

  // Pricing computed mit/ohne Discount
  const monthlyFull = "€24.99";
  const yearlyFull = "€199";
  const monthlyDiscounted = "€12.50";
  const yearlyDiscounted = "€99.50";

  return (
    <CheckoutShell>
      {hasDiscount ? (
        <>
          <h1 className="checkout-headline">Activate your founder pricing</h1>
          <p className="checkout-body">
            Pick a plan and lock in 50% off Callday for life, plus your
            first month free. Your code{" "}
            <strong className="checkout-code">{code}</strong> is applied
            automatically.
          </p>
        </>
      ) : (
        <>
          <h1 className="checkout-headline">Subscribe to Callday Pro</h1>
          <p className="checkout-body">
            Pick a plan and start dialing. Cancel or pause anytime.
          </p>
        </>
      )}

      <div className="checkout-plans">
        <form action={startCheckoutAction}>
          <input type="hidden" name="plan" value="yearly" />
          {code && <input type="hidden" name="code" value={code} />}
          {promotionCodeId && (
            <input
              type="hidden"
              name="promotionCodeId"
              value={promotionCodeId}
            />
          )}
          <button type="submit" className="checkout-plan checkout-plan-best">
            <span className="checkout-plan-badge">Best value</span>
            <span className="checkout-plan-name">Yearly</span>
            <span className="checkout-plan-price">
              {hasDiscount ? `${yearlyDiscounted}/year` : `${yearlyFull}/year`}
            </span>
            <span className="checkout-plan-note">
              {hasDiscount
                ? `50% off ${yearlyFull} · billed once per year · first month free`
                : `${yearlyFull} billed once per year (saves ~33% vs monthly)`}
            </span>
          </button>
        </form>

        <form action={startCheckoutAction}>
          <input type="hidden" name="plan" value="monthly" />
          {code && <input type="hidden" name="code" value={code} />}
          {promotionCodeId && (
            <input
              type="hidden"
              name="promotionCodeId"
              value={promotionCodeId}
            />
          )}
          <button type="submit" className="checkout-plan">
            <span className="checkout-plan-name">Monthly</span>
            <span className="checkout-plan-price">
              {hasDiscount
                ? `${monthlyDiscounted}/month`
                : `${monthlyFull}/month`}
            </span>
            <span className="checkout-plan-note">
              {hasDiscount
                ? `50% off ${monthlyFull} · first month free`
                : `Billed monthly`}
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
  const codeRaw = formData.get("code");
  const promotionCodeIdRaw = formData.get("promotionCodeId");

  if (typeof plan !== "string") {
    throw new Error("invalid form data");
  }
  if (plan !== "monthly" && plan !== "yearly") {
    throw new Error("invalid plan");
  }

  const code = typeof codeRaw === "string" && codeRaw ? codeRaw : null;
  const promotionCodeId =
    typeof promotionCodeIdRaw === "string" && promotionCodeIdRaw
      ? promotionCodeIdRaw
      : null;

  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const url = await createCheckoutSession({
    plan,
    code,
    promotionCodeId,
    userId: user.id,
    userEmail: user.email ?? null,
  });

  redirect(url);
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
