"use client";

import { useIsLoggedIn } from "@/lib/use-is-logged-in";

/**
 * Hero-CTA auf den Landings. Ausgeloggt: "Get started" → #signup.
 * Eingeloggte Rueckkehrer bekommen "Go to your dashboard" → /dashboard
 * (direkt, nicht zum #signup-Scroll), damit der prominenteste CTA der Seite
 * nicht "leg los" sagt, obwohl der User schon drin ist.
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
          <a href="/dashboard" className="hero-cta">
            Go to your dashboard
          </a>
          <p className="hero-cta-meta">You&apos;re already in.</p>
        </>
      ) : (
        <>
          <a href="#signup" className="hero-cta">
            Get started for free
          </a>
          <p className="hero-cta-meta">
            Generate your list and start calling today.
          </p>
        </>
      )}
    </div>
  );
}
