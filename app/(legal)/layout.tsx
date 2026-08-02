import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";
import { SiteFooter } from "../components/SiteFooter";

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
      <nav className="site-nav" data-scrolled="true">
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

      <SiteFooter />
    </>
  );
}
