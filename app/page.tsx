import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { FaqAccordion } from "./components/FaqAccordion";
import { FlowTabs } from "./components/FlowTabs";
import { BetaCta } from "./components/BetaCta";
import { BoxIcon } from "./components/BoxIcon";
import { BrainIcon } from "./components/BrainIcon";
import { GeneratorFeatureCard } from "./components/GeneratorFeatureCard";
import { HeroCta } from "./components/HeroCta";
import { PhoneMockup } from "./components/PhoneMockup";
import { SignupModal } from "./components/SignupModal";
import { SiteNav } from "./components/SiteNav";

export default async function Home() {
  // Eingeloggte gehoeren in die Web-App, nicht auf den Pitch: die Homepage
  // leitet sie direkt aufs Dashboard (Jan-Entscheidung 2026-07-17). Greift
  // NUR hier (/) — /a/[slug], /lists, Legal regeln ihren eingeloggten
  // Zustand selbst; ausgeloggte Besucher + Crawler sehen die Landing normal.
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <div className="bg-orb bg-orb-2" />

      {/* === NAV === */}
      <SiteNav />

      {/* === HERO — split ab 960px: Copy links, Geraet rechts ===
          Der Pre-Call-Screen steht bewusst direkt im Hero: Besucher sollen
          sofort sehen WAS die App tut und DASS sie mobil ist (Jan-Entscheidung
          2026-07-18 — loest die fruehere "kein Mockup, Hero klein halten"-
          Regel ab). Die animierte 3-Schritt-Flow darunter bleibt der
          Erklaerteil; die Hero liefert nur den statischen Hook.
          Unter 960px bleibt die zentrierte Einspalter-Hero unveraendert,
          das Geraet rutscht dort unter die CTA. */}
      <section className="hero hero-light">
        <div className="container hero-inner hero-split">
          <div className="hero-copy">
            <div className="pill reveal">
              <span className="pill-dot" />
              Generate call list for free
            </div>

            <h1 className="reveal delay-1">
              Less avoiding.
              <br />
              More <span className="accent">dialing</span>.
            </h1>

            <p className="hero-sub reveal delay-2">
              Cold callers don&apos;t lose to bad scripts. They lose to
              procrastination. Callday keeps you on the phone, one tap at a
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
                 1. dealswipe-app → `leadHeaderPill()` in
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

      {/* === THE FLOW — 3 animated steps (the centerpiece) ===
          container-wide: die Sektion bricht auf 1360px aus (einzige
          Breakout-Sektion der Seite) — groessere Animations-Kacheln. */}
      <section className="flow">
        <div className="container container-wide">
          <header className="flow-section-head">
            <h2>
              Take the friction
              <br /> out of cold calling.
            </h2>
          </header>
          <FlowTabs />
        </div>
      </section>

      {/* === STATS === */}
      <section className="social-proof">
        <div className="container">
          <div className="stats-block">
            {/* Zweiergespann statt 1-2-0-Trio (Jan 2026-07-23): die
                "2 taps"-Zelle doppelte woertlich den Flow-Step-03-Titel
                ("Booked in two taps"). 1 tap vs 0 tabs — ein Tap fuers
                Wesentliche, null Tabs fuer alles andere. */}
            <div className="stats-row">
              <div className="stat-cell">
                <div className="stat-num">
                  1<span className="unit">tap</span>
                </div>
                <div className="stat-label">to your next call</div>
              </div>
              <div className="stat-divider" />
              <div className="stat-cell">
                <div className="stat-num">
                  0<span className="unit">tabs</span>
                </div>
                <div className="stat-label">
                  no spreadsheet, no detours, no distractions
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === DIFFERENTIATORS — slimmed from the old 4-card grid ===
          The workflow mechanics now live in the animated flow above, so this
          keeps only the two "why it sticks" points that aren't shown there. */}
      <section className="features">
        <div className="container">
          <h2>
            {/* br-mobile: auf Phones bricht die Headline kontrolliert nach
                "to" um, Desktop bleibt einzeilig. */}
            Built to <br className="br-mobile" />
            fight the flinch.
          </h2>
          <p className="section-sub">
            Every detail closes a gap where focus usually dies.
          </p>

          <div className="feature-grid">
            <GeneratorFeatureCard />

            <div className="feature-card">
              <div className="feature-icon">
                {/* Quadratische Karte statt 18x13-Querformat (Jan
                    2026-07-23) — das flache Rechteck mit Strich oben las
                    sich wie eine Kreditkarte. 26px: das 16er-Quadrat hat
                    viel Luft in der ViewBox. */}
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x={4} y={4} width={16} height={16} rx={3} />
                  <path d="M4 9.5h16" />
                </svg>
              </div>
              <h3>One lead card at a time.</h3>
              <p>
                No menus. No clutter. One card, one decision: call or skip. Each
                tap pulls you deeper into the rhythm, never out of it.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <BrainIcon />
              </div>
              <h3>Rewards the dial, not the close.</h3>
              <p>
                Every call counts, not just the yeses. Voicemails count.
                &ldquo;Not interested&rdquo; counts. Your brain learns to crave
                the dial, not the outcome.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                {/* Papierflieger statt Kalender-Check (Jan 2026-07-23):
                    "Sent." ist der magische Moment der Karte — die Mail
                    fliegt raus, bevor der naechste Lead da ist. Leicht
                    nach unten links versetzt: die Flieger-Form lehnt
                    optisch nach oben rechts, der Versatz zentriert sie. */}
                <svg
                  width={23}
                  height={23}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: "translate(-1px, 1px)" }}
                >
                  <line x1={22} y1={2} x2={11} y2={13} />
                  <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                </svg>
              </div>
              <h3>Booked. Synced. Sent.</h3>
              <p>
                One tap to log a meeting. Calendar event set, confirmation
                email sent, reminder email scheduled, all done before you
                reach the next lead. No app switching. No detour.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <BoxIcon />
              </div>
              <h3>No CRM. No spreadsheet.</h3>
              <p>
                Every call, note, and outcome stays in the app. No pipeline
                to maintain. No spreadsheet to update. The system is the
                calling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === BIG CTA — BetaCta rendert die Section-h2 + ausgeloggt das
          Sign-up, eingeloggt eine "You're already in"-Karte. Identisch zur
          Affiliate-Landing, nur ohne slug. === */}
      <section className="big-cta" id="signup">
        <div className="container big-cta-inner">
          <BetaCta />
        </div>
      </section>

      {/* === FAQ === */}
      <section className="faq" aria-label="Common questions">
        <div className="container faq-inner">
          <h2 className="faq-heading">Common questions.</h2>
          <FaqAccordion />
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="site-footer site-footer-brand">
        <div className="container footer-brand-row">
          <p className="footer-tagline-big">Make today a Callday.</p>
          <div className="footer-meta">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </footer>

      {/* Sign-up-Modal (Hero-/Nav-„Get started" oeffnen es); portalt nach
          document.body, Position im Baum egal. Ohne slug auf der organischen
          Landing. */}
      <SignupModal />
    </>
  );
}
