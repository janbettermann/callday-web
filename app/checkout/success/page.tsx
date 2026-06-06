import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../../components/CalldayLogo";

export const metadata: Metadata = {
  title: "Welcome to Callday Pro · Callday",
  description: "Your founder pricing is locked in.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

/**
 * /checkout/success?session_id=cs_...
 *
 * Stripe redirected hierher nach erfolgreichem Checkout. Zu diesem
 * Zeitpunkt hat Stripe das Subscription-Event auch schon an unseren
 * Webhook geschickt — die profile.subscription_status sollte 'active'
 * sein (kann minimal verzögert sein, daher kein blockierendes Polling).
 *
 * Wir vertrauen der Redirect-Signatur (Stripe würde nur bei Success-
 * Status hierher schicken). Anzeige + Hinweis was als Nächstes kommt.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps) {
  // Session-ID wird hier (Phase 3 MVP) nicht weiter ausgewertet —
  // könnte später für ein Stripe-Receipt-Lookup genutzt werden.
  await searchParams;

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

      <main className="confirm-page">
        <div className="confirm-inner">
          <div className="confirm-icon">
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="confirm-headline">You&apos;re a founder.</h1>

          <p className="confirm-body">
            Your founder pricing is locked in. 50% off Callday for life,
            first month free. We just emailed your receipt to your inbox.
          </p>

          <p className="confirm-body">
            Open Callday on your iPhone (or install it from the App Store)
            and sign in with the same email — your subscription is already
            active.
          </p>

          <Link href="/" className="hero-cta confirm-cta">
            Back to homepage
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1={5} y1={12} x2={19} y2={12} />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
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
