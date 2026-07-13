import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";

/**
 * Nav der Listen-Welt (Landing, Uebersicht, Generator) — Logo +
 * "Lists"-Sub-Brand-Pill. Rechts kontextabhaengig: ausgeloggt der
 * Sign-in-Link (Ziel konfigurierbar, damit Filter-Presets ueberleben),
 * eingeloggt der Weg zurueck zur Account-Sektion.
 */
export function ListsNav({
  authed,
  signInNext = "/lists",
}: {
  authed: boolean;
  signInNext?: string;
}) {
  return (
    <nav className="site-nav" data-scrolled="true">
      <div className="container nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
          <span className="lists-brand-pill">Lists</span>
        </div>
        {authed ? (
          <Link className="nav-cta" href="/account">
            Account
          </Link>
        ) : (
          <Link
            className="nav-cta"
            href={`/login?next=${encodeURIComponent(signInNext)}`}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
