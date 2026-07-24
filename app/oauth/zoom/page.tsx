import type { Metadata } from "next";
import Link from "next/link";
import { CalldayLogo } from "../../components/CalldayLogo";
import { ZoomReturn } from "./ZoomReturn";

/**
 * /oauth/zoom — Bounce-Seite fuer den Zoom-OAuth-Connect der Mobile-App.
 *
 * Zoom erzwingt eine https-Redirect-URL (Custom-Schemes sind bei Zoom nur
 * fuer Meeting-SDK-Apps erlaubt, nicht fuer OAuth-Apps). Diese Seite ist das
 * registrierte Redirect-Ziel `https://callday.io/oauth/zoom`: sie faengt den
 * von Zoom angehaengten `code` (+ `state`) ab und reicht ihn an das native
 * App-Scheme `dealswipe://oauth/zoom` weiter, wo expo-auth-session den
 * PKCE-Code-Tausch abschliesst. Der `code_verifier` bleibt die ganze Zeit in
 * der App — diese Seite sieht ihn nie.
 *
 * Volle Spec: dealswipe-app/specs/zoom-integration.md (Abschnitt 3).
 */

export const metadata: Metadata = {
  title: "Connecting Zoom · Callday",
  robots: { index: false, follow: false },
};

const APP_SCHEME_REDIRECT = "dealswipe://oauth/zoom";

type PageProps = {
  searchParams: Promise<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>;
};

export default async function ZoomOAuthBouncePage({ searchParams }: PageProps) {
  const { code, state, error } = await searchParams;

  // Whitelist: nur die OAuth-relevanten Params weiterreichen, nichts sonst.
  const forwarded = new URLSearchParams();
  if (code) forwarded.set("code", code);
  if (state) forwarded.set("state", state);
  if (error) forwarded.set("error", error);

  const query = forwarded.toString();
  const deepLink = query ? `${APP_SCHEME_REDIRECT}?${query}` : null;

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
        <ZoomReturn deepLink={deepLink} hasError={!!error} />
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
