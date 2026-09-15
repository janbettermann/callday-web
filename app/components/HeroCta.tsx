"use client";

import { trackLpEvent } from "@/lib/lp/client";
import { useIsLoggedIn } from "@/lib/use-is-logged-in";
import { openSignupModal } from "@/lib/use-signup-modal";

/**
 * Hero-CTA auf den Landings (Teil von LandingHero). Ausgeloggt oeffnet der
 * Button das Sign-up-Modal (siehe SignupModal) statt zur #signup-Sektion zu
 * scrollen — faengt die Absicht direkt am Hero ab. Der `href="#signup"`
 * bleibt als No-JS-Fallback (preventDefault + Modal nur wenn JS laeuft).
 * Eingeloggte Rueckkehrer bekommen "Go to your dashboard" → /dashboard
 * (direkt, kein Modal), damit der prominenteste CTA der Seite nicht "leg
 * los" sagt, obwohl der User schon drin ist.
 *
 * Label "Build your first call list" (Jan-Entscheidung 2026-09-15, vorher
 * "Get started for free"): nennt das Ding, das der Besucher nach dem Klick
 * in der Hand hat, statt eines generischen Einstiegs — der Web-Funnel ist
 * list-first, und "Build" ist das Verb des echten Generator-Buttons auf
 * /lists/new ("Build my list"). Damit der Button sein Versprechen haelt,
 * landet das Modal-Sign-up direkt im Generator (nextPath in SignupModal).
 * Weil "free" nicht mehr im Button steht, traegt die Meta-Zeile darunter
 * die Rueckversicherung "Free. No credit card." (Jan-Entscheidung
 * 2026-09-15: kurz, bezieht sich auf die Liste im Button direkt darueber;
 * die laengere Form "Your first list is free. No credit card." war der
 * Vorschlag und liegt in der Git-History); der Markensatz "Make today a
 * Callday." ist dafuer aus dem Hero raus und bleibt die H2 der
 * Signup-Sektion. Die Zeile sitzt in einem <mark> (Styles: .hero-cta-meta
 * mark in globals.css): leichter Blau-Tint, Schrift im dunklen Button-
 * Blau — Jan-Wahl 2026-09-15 (Variante E) gegen einen Sonnen-Tint, weil
 * der Hero so bei einer Farbfamilie bleibt. Bekannter Preis: eine helle
 * blaue Flaeche mit blauer Schrift unter dem Button kann wie ein zweiter,
 * leichterer Button wirken; deshalb Marker-Geometrie (kleiner Radius,
 * wenig Innenabstand), keine Pille. Kein A/B-Test dafuer: vor dem Start
 * der Meta-Ads gibt es keine Baseline zu schuetzen, der erste Test-Slot
 * gehoert der Headline.
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
            <CtaArrow />
          </a>
          <p className="hero-cta-meta">You&apos;re already in.</p>
        </>
      ) : (
        <>
          <a
            href="#signup"
            className="hero-cta"
            onClick={(e) => {
              e.preventDefault();
              trackLpEvent("cta_click", "hero");
              openSignupModal();
            }}
          >
            Build your first call list
            <CtaArrow />
          </a>
          <p className="hero-cta-meta">
            <mark>Free. No credit card.</mark>
          </p>
          {/* Plattform-Hinweis (Jan 2026-07-23): Android-Besucher sollen es
              VOR dem Sign-up wissen. Die Eyebrow nennt die Zielgruppe, nicht
              die Plattform, "iOS" steht sonst nirgends im Hero — deshalb die
              volle Zeile. */}
          <p className="hero-cta-platform">iOS only. Android coming later.</p>
        </>
      )}
    </div>
  );
}

/* Pfeil als SVG statt Text-Glyph (ein "→" im Button-Font sitzt fast immer
   schief) — gleiche Geometrie wie der Dashboard-Dropin-Pfeil. */
function CtaArrow() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
