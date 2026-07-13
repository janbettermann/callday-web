import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";

/**
 * Nav der LOGGED-OUT Listen-Landing — Logo + "Lists"-Sub-Brand-Pill
 * (Akquise-Branding) + Sign-in-Link. Das Ziel des Sign-in ist
 * konfigurierbar, damit Filter-Presets den Login-Umweg ueberleben.
 * Eingeloggte Seiten nutzen die AppNav (components/AppNav.tsx).
 */
export function ListsNav({ signInNext = "/lists" }: { signInNext?: string }) {
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
        <Link
          className="nav-cta"
          href={`/login?next=${encodeURIComponent(signInNext)}`}
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}
