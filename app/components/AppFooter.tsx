import Link from "next/link";

/**
 * Standard-Footer des eingeloggten Bereichs. Gleiches Layout wie der
 * Landing-Footer (Marken-Statement links, Legal-Links rechtsbuendig auf
 * gleicher Hoehe, kein Logo, kein Trenner) — nur die Legal-Links sind
 * hier via .app-footer bewusst dezenter (siehe globals.css).
 */
export function AppFooter() {
  return (
    <footer className="site-footer site-footer-brand app-footer">
      <div className="container footer-brand-row">
        <p className="footer-tagline-big">Make today a Callday.</p>
        <div className="footer-meta">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/terms#imprint">Imprint</Link>
          <a href="mailto:hello@callday.io">hello@callday.io</a>
        </div>
      </div>
    </footer>
  );
}
