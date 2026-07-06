import type { Metadata } from "next";
import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";
import { ConfirmCard } from "./ConfirmCard";

/**
 * /confirm — Code-Bestaetigung nach Email/PW-Sign-Up (Landing + /a/[slug]).
 *
 * Eigene Route statt In-Place-Swap in der SignupForm (Jan-Decision
 * 2026-07-05). Drei Gruende:
 *   1. Reload-Festigkeit — der OTP-Step lebte vorher nur im React-State;
 *      F5 oder Tab-Wechsel warf den User zurueck vors Sign-up-Formular.
 *   2. Funnel-Messbarkeit — Vercel Analytics (Hobby) trackt nur
 *      Page-Views; /confirm macht den Drop-off "Formular abgeschickt,
 *      Code nie bestaetigt" als eigenen Step sichtbar.
 *   3. Kontext — "Check your inbox" unter der "Get early access."-Hero-
 *      Headline der Landing wirkte inkonsistent; die ruhige Standalone-
 *      Seite spiegelt den Postfach-Kontextwechsel.
 *
 * Email-Handoff via sessionStorage, nicht Query-Param (PII in Logs) —
 * siehe lib/signup-confirm.ts. Shell-Aufbau wie /login.
 */

export const metadata: Metadata = {
  title: "Confirm your account · Callday",
  robots: { index: false, follow: false },
};

export default function ConfirmPage() {
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
        <ConfirmCard />
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
