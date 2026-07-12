"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalldayLogo } from "../components/CalldayLogo";
import { SignupForm } from "../components/SignupForm";
import { useIsLoggedIn } from "@/lib/use-is-logged-in";

/**
 * /lists — die Logged-out-Akquise-Tuer des Listen-Generators.
 *
 * Architektur-Entscheidung 2026-07-13: Der Generator selbst lebt in der
 * Account-Sektion (app/account/LeadListsSection.tsx) — EIN Logged-in-
 * Zuhause fuer beide Funnel. Diese Seite bleibt als eigenstaendige
 * Landing bestehen, weil der Funnel-Eintritt ausgeloggt passiert und
 * Message-Match braucht: Affiliate-/SEO-Traffic mit Listen-Intent muss
 * auf einer Seite landen, deren Headline LISTEN verspricht, nicht die
 * App. Eingeloggte Besucher werden zum Account umgeleitet; Query-
 * Presets (?website=without, Affiliate-Links) reisen durch Signup und
 * Redirect mit.
 */

const subBrandPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 100,
  background: "rgba(53, 100, 224, 0.1)",
  border: "0.5px solid rgba(53, 100, 224, 0.22)",
  color: "var(--blue-deep)",
  fontFamily: "var(--font-label)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  lineHeight: 1,
};

export function ListsClient() {
  const loggedIn = useIsLoggedIn();
  const router = useRouter();

  // Ziel nach Signup/Redirect — traegt das Filter-Preset weiter.
  const [nextPath, setNextPath] = useState("/account");

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("website");
    if (preset === "without" || preset === "with") {
      setNextPath(`/account?website=${preset}`);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) router.replace(nextPath);
  }, [loggedIn, nextPath, router]);

  return (
    <>
      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" className="logo" style={{ textDecoration: "none" }}>
              <CalldayLogo size={32} />
              Callday
            </Link>
            <span style={subBrandPillStyle}>Lists</span>
          </div>
          <Link className="nav-cta" href="/login?next=%2Faccount">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="lists-page">
        <div className="lists-inner">
          <header className="lists-hero">
            <h1 className="lists-headline">
              Your cold-calling list, in 2 minutes.
            </h1>
            <p className="lists-sub">
              Pick an industry and a city. We build a call-ready lead list —
              every lead with a phone number, deduped, ready to dial. Your
              first list is free.
            </p>
          </header>
          <SignupForm nextPath={nextPath} />
          <p className="lists-meta">
            Free — no credit card. Your list syncs straight to the Callday
            app.
          </p>
        </div>
      </main>
    </>
  );
}
