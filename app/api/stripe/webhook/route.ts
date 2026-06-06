/**
 * POST /api/stripe/webhook
 *
 * Stripe-Webhook-Handler. Synct Subscription-State zwischen Stripe und
 * profiles in Supabase. Außerdem markiert er bei checkout.session.completed
 * den Founder-Code als eingelöst in applications.
 *
 * Signature-Verification via STRIPE_WEBHOOK_SECRET (separat pro Stripe-
 * Webhook-Endpoint, pro Test- vs. Live-Mode). Stripe's CLI gibt für
 * lokales Testen einen eigenen Secret aus.
 *
 * Idempotenz: Webhook-Events werden idempotent verarbeitet — wir
 * UPDATE-en denselben profile mit demselben State mehrfach ohne Effekt.
 * Stripe retried bei non-2xx-Response, daher gibt's keine spezielle
 * Logik dafür.
 */

import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mapping price-ID → unser Plan-Enum. Funktioniert sowohl für Test-Mode
// als auch Live-Mode, weil die env-Vars jeweils die richtigen IDs enthalten.
function planFromPriceId(priceId: string): "monthly" | "yearly" | null {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY) {
    return "monthly";
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY) {
    return "yearly";
  }
  return null;
}

interface SubscriptionPatch {
  stripe_customer_id: string;
  subscription_status: string;
  subscription_plan: "monthly" | "yearly" | null;
  subscription_renews_at: string | null;
}

function getPeriodEnd(
  subscription: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
): number | null {
  // Stripe hat current_period_end zwischen API-Versionen umgezogen.
  // Pre-2024: auf Subscription-Level (subscription.current_period_end).
  // Newer: auf SubscriptionItem-Level (für multi-period-billing).
  // Wir checken beide Orte und nehmen den ersten der existiert.
  const itemEnd = (item as { current_period_end?: number })
    .current_period_end;
  if (typeof itemEnd === "number") return itemEnd;

  const subEnd = (subscription as { current_period_end?: number })
    .current_period_end;
  if (typeof subEnd === "number") return subEnd;

  return null;
}

function buildSubscriptionPatch(
  subscription: Stripe.Subscription,
): SubscriptionPatch | null {
  const item = subscription.items.data[0];
  if (!item) return null;

  const plan = planFromPriceId(item.price.id);
  const periodEnd = getPeriodEnd(subscription, item);

  return {
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscription_status: subscription.status,
    subscription_plan: plan,
    subscription_renews_at: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };
}

async function syncSubscription(subscription: Stripe.Subscription) {
  // user_id kommt aus subscription.metadata.callday_user_id, die wir
  // beim Checkout-Session-Create in subscription_data.metadata gesetzt
  // haben. Fallback auf NULL → wir können nichts mappen + loggen.
  const userId = subscription.metadata?.callday_user_id;
  if (!userId) {
    console.error(
      "[/api/stripe/webhook] subscription without callday_user_id metadata",
      { subscription_id: subscription.id },
    );
    return;
  }

  const patch = buildSubscriptionPatch(subscription);
  if (!patch) {
    console.error(
      "[/api/stripe/webhook] subscription without items",
      { subscription_id: subscription.id },
    );
    return;
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  if (error) {
    console.error("[/api/stripe/webhook] profile update failed", error);
    throw error;
  }
}

async function markCodeRedeemed(session: Stripe.Checkout.Session) {
  const code = session.metadata?.callday_code;
  if (!code) return;

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("applications")
    .update({ code_redeemed_at: new Date().toISOString() })
    .eq("founder_code", code);

  if (error) {
    // Nicht-fatal — der Code kann auch ohne applications-Row eingelöst
    // worden sein (Pre-Launch interner Test). Nur loggen.
    console.error(
      "[/api/stripe/webhook] applications.code_redeemed_at update failed",
      error,
    );
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[/api/stripe/webhook] STRIPE_WEBHOOK_SECRET missing");
    return Response.json({ error: "not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  // RAW body für die Signature-Verifikation — KEIN JSON-Parse vorher!
  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[/api/stripe/webhook] signature verification failed", {
      message,
    });
    return Response.json(
      { error: `invalid signature: ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;

      case "customer.subscription.deleted":
        // Bei deletion bleibt die ID + customer-Verknüpfung, aber status
        // wird auf 'canceled'. Wir patchen weiter über syncSubscription.
        await syncSubscription(event.data.object);
        break;

      case "checkout.session.completed":
        await markCodeRedeemed(event.data.object);
        break;

      default:
        // Stripe schickt viele weitere Events — wir akzeptieren sie
        // nur (2xx), tun aber nichts. So loggt Stripe sie als "delivered"
        // und retried sie nicht.
        break;
    }
  } catch (err) {
    // Fehler im Handler → 500 → Stripe retried. Bei wiederholten Fehlern
    // landet das Event im Failed-Tab im Stripe-Dashboard.
    console.error("[/api/stripe/webhook] handler error", err);
    return Response.json({ error: "handler error" }, { status: 500 });
  }

  return Response.json({ received: true });
}
