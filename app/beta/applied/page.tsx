import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../../components/CalldayLogo";

export const metadata: Metadata = {
  title: "You're on the list · Callday",
  description: "Your Callday beta application is in.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

/**
 * /beta/applied — dedicated confirmation page after submitting the beta
 * application form. Two visual variants based on ?status query param:
 *
 *   (default)     → fresh application landed
 *   ?status=duplicate → user already applied previously
 *
 * Per UX-Entscheidung 2026-06-06: für eine Beta-Waitlist ist die
 * Email-Enumeration-Protection (alle Submits = gleiches UI) weniger wert
 * als klare Kommunikation an den User. Deshalb expliziter Duplicate-State.
 * Kein automatischer Re-Send der Confirmation-Mail beim Duplicate — User
 * checkt Inbox/Spam selbst, oder antwortet auf die Original-Mail wenn was
 * kaputt ist.
 */
export default async function BetaAppliedPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const isDuplicate = status === "duplicate";

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
          {/* Kein nav-cta — Back-to-Homepage steckt schon prominent als
              Haupt-CTA unter dem Body. Doppelter Button war redundant. */}
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

          {isDuplicate ? (
            <>
              <h1 className="confirm-headline">
                Looks like we&apos;ve got you already.
              </h1>

              <p className="confirm-body">
                Your earlier application is still in review. Check your
                inbox for the confirmation from{" "}
                <strong>hello@callday.io</strong>. If you don&apos;t see
                it, check spam. If anything looks broken, just reply to
                that email and we&apos;ll take a look.
              </p>

              <p className="confirm-body">
                Either way, your founder spot is locked in: a personal
                code at launch, 50% off Callday for life, plus your first
                month free.
              </p>
            </>
          ) : (
            <>
              <h1 className="confirm-headline">You&apos;re on the list.</h1>

              <p className="confirm-body">
                We&apos;ll review your application and get back to you
                within 48 hours. Check your inbox. We just sent a
                confirmation from <strong>hello@callday.io</strong>. If
                you don&apos;t see it within a few minutes, check spam.
              </p>

              <p className="confirm-body">
                Either way, your founder spot is locked in: a personal
                code at launch, 50% off Callday for life, plus your first
                month free.
              </p>
            </>
          )}

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
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </footer>
    </>
  );
}
