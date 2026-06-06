/**
 * Stripe-SDK-Instance für Server-Side-Operationen (Checkout-Session
 * erstellen, Promotion-Codes validieren, Webhook-Signaturen prüfen).
 *
 * apiVersion bewusst NICHT gepinnt — wir folgen der Default-API-Version
 * des Stripe-Accounts. Bei Breaking-Changes auf Stripe-Seite bekommen
 * wir per Email Vorwarnung + können gezielt upgraden.
 *
 * Nur server-seitig importieren — die secret-key darf NIE im Client-
 * Bundle landen.
 */

import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}
