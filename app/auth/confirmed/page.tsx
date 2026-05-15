import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../../components/CalldayLogo";

export const metadata: Metadata = {
  title: "E-Mail bestätigt — Callday",
  description:
    "Deine E-Mail-Adresse ist verifiziert. Zurück zur Callday-App auf dem iPhone.",
  robots: { index: false, follow: false },
};

/**
 * Landing page that Supabase redirects to after successful email
 * confirmation. Server Component — no auth logic, no API calls.
 *
 * Supabase verifies the token server-side BEFORE the user's browser
 * lands here, so anyone reaching this URL is already confirmed. The
 * URL fragment (#access_token=…&refresh_token=…&type=signup) is for
 * the mobile app deep-link flow and is intentionally ignored here.
 */
export default function AuthConfirmedPage() {
  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav className="site-nav">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
          <Link href="/" className="nav-cta">
            ← Zur Startseite
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

          <h1 className="confirm-headline">
            E-Mail bestätigt <span className="confirm-emoji">🎉</span>
          </h1>

          <p className="confirm-body">
            Deine E-Mail-Adresse ist jetzt verifiziert. Geh zurück zur
            Callday-App auf deinem iPhone und logge dich ein — dort
            geht&apos;s los.
          </p>

          <a href="callday://" className="hero-cta confirm-cta">
            Callday öffnen
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
          </a>

          <p className="confirm-note">
            Funktioniert nur auf einem iPhone, auf dem Callday schon
            installiert ist.
          </p>
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
            <a href="mailto:hello@callday.app">hello@callday.app</a>
          </div>
        </div>
      </footer>
    </>
  );
}
