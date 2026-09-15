import { HeroCta } from "./HeroCta";
import { PhoneMockup } from "./PhoneMockup";

/**
 * Hero der Landings — geteilt zwischen organischer Landing (app/page.tsx)
 * und Affiliate-Landing (/a/[slug]). Bis 2026-09-15 stand das Markup in
 * beiden Pages ausgeschrieben und war bereits gedriftet (Affiliate ohne
 * Geraet, Sub-Zeile "one tap" statt "one call"); seitdem gibt es den Hero
 * genau einmal.
 *
 * Aufbau (Jan-Entscheidungen 2026-09-15, zusammen mit dem neuen CTA):
 *   - KEINE Eyebrow mehr, die H1 eroeffnet den Hero. Historie: Announce-
 *     ment-Pille → Textmarker-Angebot "Generate your first call list for
 *     free" (2026-09-14) → kurz ein Kategorie-Label "The cold-calling app
 *     for iPhone." ohne Marker → am selben Tag ganz gestrichen. Grund: das
 *     Angebot wanderte in den CTA ("Build your first call list") und die
 *     Gratis-Zeile darunter, damit hatte der Slot keinen Job mehr; ein
 *     Label als Fueller wollte Jan nicht. Die Plattform-Info lebt wieder
 *     komplett in der Zeile unter dem Button ("iOS only. Android coming
 *     later."). Eyebrow-Markup + .hero-eyebrow-Styles liegen in der
 *     Git-History.
 *   - Das Gratis-Versprechen steht als blauer Marker in der Meta-Zeile
 *     unter dem Button (siehe HeroCta), der Markensatz "Make today a
 *     Callday." bleibt die H2 der Signup-Sektion.
 *   - Split ab 960px: Copy links, Geraet rechts. Der Pre-Call-Screen steht
 *     bewusst direkt im Hero: Besucher sollen sofort sehen WAS die App tut
 *     und DASS sie mobil ist (Jan-Entscheidung 2026-07-18). Die animierte
 *     3-Schritt-Flow darunter bleibt der Erklaerteil; der Hero liefert nur
 *     den statischen Hook. Unter 960px zentrierte Einspalter-Hero, das
 *     Geraet rutscht dort unter die CTA.
 *
 * Split-Test-Varianten (lib/lp/experiments.ts, docs/experiments.md) werden
 * in app/page.tsx entschieden und hier per Props durchgereicht — z. B. ein
 * optionales `headline`-Prop, sobald der erste Headline-Test startet.
 */
export function LandingHero() {
  return (
    <section className="hero hero-light">
      <div className="container hero-inner hero-split">
        <div className="hero-copy">
          <h1 className="reveal delay-1">
            Less avoiding.
            <br />
            More <span className="accent">dialing</span>.
          </h1>

          <p className="hero-sub reveal delay-2">
            Cold callers don&apos;t lose to bad scripts. They lose to
            procrastination. Callday keeps you on the phone, one call at a
            time.
          </p>

          <HeroCta />
        </div>

        <div className="hero-visual reveal">
          {/* BEWUSSTE ABWEICHUNG vom App-Label — bitte nicht "korrigieren":
              Der Screenshot zeigt die grüne Status-Pille als "NEW LEAD",
              die App selbst beschriftet sie mit "NEW". Grund: Auf der
              Landing Page hat ein Erstbesucher zwei Sekunden, da ist das
              Substantiv selbsterklärender. In der App wäre "LEAD"
              redundant (man steht auf einer Lead-Karte) und würde das
              Gegenstück "NOT REACHED" asymmetrisch machen.

              Screenshot neu aufnehmen (Rezept):
               1. callday-app → `leadHeaderPill()` in
                  components/shared/LeadStatusPill.tsx: Label temporär auf
                  "NEW LEAD" stellen.
               2. Aufnahme aus einer NORMALEN Liste mit Fantasie-Leads —
                  nicht aus der Demo-Liste (dort gewinnt "DEMO LEAD") und
                  keine echten Kundendaten (die Seite ist öffentlich).
               3. Label sofort wieder auf "NEW" zurückstellen.
              Die Jitter-Animation in Step 02 muss dieselbe Beschriftung
              tragen, sonst ist die Seite in sich inkonsistent. */}
          <PhoneMockup
            src="/hero-precall-iphone.png"
            alt="Callday auf dem iPhone: die Pre-Call-Karte eines Leads mit „New lead“-Markierung, Website- und Google-Profil-Link, Standort- und Branchenangaben und großem Call-Button."
            priority
          />
        </div>
      </div>
    </section>
  );
}
