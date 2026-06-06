import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";

/**
 * Shared frame for /privacy and /terms. The legal pages live under the
 * (legal) route group so they get a stripped-back header (just the
 * Callday wordmark + a back-link), the light brand theme of the rest
 * of the site, and a readable max-width column for the long-form text.
 *
 * Background orbs are intentionally omitted — they overlap badly with
 * blocks of text and pull attention from the content.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="site-nav">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
          <Link href="/" className="nav-cta">
            ← Zurück
          </Link>
        </div>
      </nav>

      <main className="legal-page">{children}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
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
