"use client";

import { useEffect, useState } from "react";
import { SignupForm } from "../components/SignupForm";
import { ListsNav } from "./ListsNav";

/**
 * /lists — die Logged-out-Akquise-Tuer des Listen-Generators.
 *
 * Eingeloggte Besucher sieht diese Komponente nie — der Server-Wrapper
 * (page.tsx) rendert fuer sie direkt die Listen-Uebersicht. Diese
 * Landing bleibt eigenstaendig, weil der Funnel-Eintritt ausgeloggt
 * passiert und Message-Match braucht: Affiliate-/SEO-Traffic mit
 * Listen-Intent muss auf einer Seite landen, deren Headline LISTEN
 * verspricht, nicht die App.
 *
 * Signup fuehrt direkt in den Generator (/lists/new) — Query-Presets
 * (?website=without, Affiliate-Links) reisen durch Signup und Login mit.
 */

export function ListsClient() {
  // Ziel nach Signup/Sign-in — traegt das Filter-Preset weiter.
  const [nextPath, setNextPath] = useState("/lists/new");

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("website");
    if (preset === "without" || preset === "with") {
      setNextPath(`/lists/new?website=${preset}`);
    }
  }, []);

  return (
    <>
      <ListsNav signInNext={nextPath} />

      <main className="lists-page">
        <div className="lists-inner">
          <header className="lists-hero">
            <h1 className="lists-headline">
              Your cold-calling list, in 2 minutes.
            </h1>
            <p className="lists-sub">
              Pick an industry and a city. We scan Google Maps and build a
              call-ready lead list — every lead with a phone number, deduped,
              ready to dial. Your first list is free.
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
