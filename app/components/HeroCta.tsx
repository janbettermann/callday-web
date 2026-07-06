"use client";

import { useIsLoggedIn } from "@/lib/use-is-logged-in";

/**
 * Hero-CTA auf den Landings. Ausgeloggt: "Get early access" → #beta.
 * Eingeloggte Rueckkehrer bekommen "Go to your account" → /account (direkt,
 * nicht zum #beta-Scroll), damit der prominenteste CTA der Seite nicht "hol
 * dir Zugang" sagt, obwohl der User schon drin ist.
 *
 * Der Wrapper behaelt `reveal delay-3` (self-playing CSS-Animation) — nur
 * der Inhalt swappt, die Animation feuert weiterhin einmal beim Laden.
 */
export function HeroCta() {
  const loggedIn = useIsLoggedIn();

  return (
    <div className="hero-cta-wrap reveal delay-3">
      {loggedIn ? (
        <>
          <a href="/account" className="hero-cta">
            Go to your account
          </a>
          <p className="hero-cta-meta">You&apos;re already in.</p>
        </>
      ) : (
        <>
          <a href="#beta" className="hero-cta">
            Get early access
          </a>
          <p className="hero-cta-meta">Start calling today. Free iOS beta.</p>
        </>
      )}
    </div>
  );
}
