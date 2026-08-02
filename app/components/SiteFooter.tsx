import Link from "next/link";
import { CalldayLogo } from "./CalldayLogo";

/**
 * Der eine Footer für alle Seiten (Statement-Design, 2026-08-02).
 *
 * Ersetzt die zuvor in 9 Dateien kopierten Footer-Varianten. Aufbau:
 * grosses Marken-Statement mit sun-gelbem Punkt, darunter Servicezeile
 * mit Logo + Copyright links und den Meta-Links rechts.
 *
 * Imprint zeigt bewusst auf /terms/de#imprint — der Anker existiert nur
 * im deutschen Terms-Dokument (Impressumspflicht ist deutsches Recht).
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p className="footer-statement">
          Make today a Callday<span className="footer-statement-dot">.</span>
        </p>
        <div className="footer-service-row">
          <span className="footer-brand">
            <CalldayLogo size={26} />
            <span className="footer-copy">
              © {new Date().getFullYear()} CALLDAY
            </span>
          </span>
          <div className="footer-meta">
            <Link href="/support">Support</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms/de#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
