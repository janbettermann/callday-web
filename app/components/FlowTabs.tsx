"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { FlowAnimation } from "./FlowAnimation";

type Step = {
  num: string;
  title: string;
  copy: string;
  badge: string;
  label: string;
  desc: string;
  /**
   * Wenn true, ersetzt das Video-Asset (FlowAnimation) den Text-Placeholder
   * — Desktop + Mobile gleichermassen. Steps ohne Video bekommen weiter
   * den label+desc-Placeholder. So koennen Animationen einzeln nachgereicht
   * werden ohne den ganzen Block umzubauen.
   */
  hasAnimation?: boolean;
  /** Optionaler Link unter der Copy (Desktop-Karte + Mobile-Karte). */
  link?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Start with any list",
    // Import bleibt vorn (die Animation zeigt Drag & Drop), der Generator
    // ist der Zweitweg im selben Satz. Der fruehere Step-Link ("Where to
    // get a list" → /first-list, spaeter "Get your first list free" →
    // #signup) ist seit 2026-07-23 komplett raus — der Generator
    // beantwortet die "Woher Liste?"-Frage in der Copy selbst.
    copy: "Drop in any CSV or Excel — or pick an industry and location, and Callday generates a call list from Google Maps.",
    badge: "Animation 01",
    label: "Drag & drop import",
    desc: "An Excel file drops into the import zone and becomes a lead list that joins your stack of audiences.",
    hasAnimation: true,
  },
  {
    num: "02",
    title: "Get into the rhythm",
    copy: "One lead per card. Tap to call, tap to log, and the next lead's already there.",
    badge: "Animation 02",
    label: "The calling loop",
    desc: "One lead card: tap to call, tap the outcome, the next card slides in. A counter ticks up on every dial.",
    hasAnimation: true,
  },
  {
    num: "03",
    title: "Booked in two taps",
    copy: "Meeting? Two taps, calendar event & confirmation email fire before the next lead lands.",
    badge: "Animation 03",
    label: "Booked. Synced. Sent.",
    desc: "A booked meeting cascades into a calendar event and a confirmation email, auto-fired before the next lead.",
    hasAnimation: true,
  },
];

/**
 * The 3-step flow section.
 *
 * Two completely separate DOM trees, one for each breakpoint — much
 * simpler than trying to make a single tree morph between two very
 * different shapes:
 *
 *   Desktop (>960 px) — `.flow-desktop`:
 *     3 gleiche Karten nebeneinander (V1-Redesign 2026-07-23, ersetzt
 *     das fruehere Tablist+Stage-Layout). Alle drei Animationen sind
 *     gleichzeitig sichtbar; welche gerade SPIELT, steuert die
 *     Staffel-Logik (siehe FlowTabs). Das verletzt das Produktprinzip
 *     "nichts bewegt sich ohne bewussten Tap" bewusst NICHT: anders als
 *     die 2026-07-05 entfernte Auto-Rotation wechselt hier kein Inhalt
 *     unter dem Leser — Karten und Copy stehen fest, nur welches Video
 *     laeuft wandert (heute spielt beim Reinscrollen auch schon eines).
 *
 *   Mobile (≤960 px) — `.flow-mobile`:
 *     A vertical stack of 3 white cards, all visible at once — scroll
 *     is the only navigation. Jede Karte spielt ihre Animation, solange
 *     sie ueberwiegend im Viewport steht (eigener IntersectionObserver
 *     pro Karte, siehe MobileFlowCard). Unveraendert vom V1-Redesign.
 *
 * CSS toggles the two wrappers via `display: none` so only one is
 * laid out at a time. `prefers-reduced-motion: reduce` wird in
 * FlowAnimation respektiert: Videos bleiben auf Frame 0 pausiert,
 * die Staffel startet dann nicht (Play-Toggle = bewusster Einstieg).
 */
/**
 * "Element ist ueberwiegend (>= 50%) im Viewport" — aus zwei Quellen:
 *
 *   1. IntersectionObserver (threshold 0.5) — der Normalfall, feuert in
 *      beide Richtungen beim Kreuzen der Schwelle.
 *   2. Passiver Scroll/Resize-Listener, der die Sichtbarkeit direkt aus
 *      getBoundingClientRect berechnet (rAF-gedrosselt).
 *
 * Warum doppelt: Mobile Safari's IO ist nachweislich unzuverlaessig
 * (siehe SiteNav — dort blieb der Intersection-State haengen und wurde
 * durch einen Scroll-Listener ersetzt). Haengt der IO, korrigiert der
 * Scroll-Pfad bei der naechsten Scroll-Bewegung in beide Richtungen —
 * ein Video, das faelschlich steht, startet; eines, das faelschlich
 * laeuft, pausiert. Beide Quellen schreiben denselben State, die
 * juengere Messung gewinnt.
 *
 * Ein display:none-Element (der jeweils andere Breakpoint-Tree) hat
 * rect.height 0 und meldet konsistent "nicht sichtbar".
 */
function useMostlyInView<T extends HTMLElement>(
  ref: RefObject<T | null>,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.5 }
    );
    obs.observe(el);

    let rafPending = false;
    const check = () => {
      rafPending = false;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) {
        setInView(false);
        return;
      }
      const viewportH = window.innerHeight;
      const visiblePx = Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0);
      setInView(visiblePx / rect.height >= 0.5);
    };
    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(check);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    check();

    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);

  return inView;
}

/**
 * Staffel-Logik Desktop (Jan-Konzept 2026-07-23):
 *
 *   - Sektion mehrheitlich im Viewport → Karte 0 spielt (ohne loop).
 *     `ended` uebergibt an die naechste Karte, nach 03 beginnt der
 *     Zyklus wieder bei 01 — eine nach einem Durchlauf eingefrorene
 *     Sektion wirkt kaputt, Besucher scrollen zu beliebigen Zeitpunkten
 *     rein.
 *   - Hover (nur echte Maus, pointerType-Guard) zieht die Staffel auf
 *     die Karte: sie spielt von vorn und LOOPT, solange der Cursor
 *     drauf bleibt. Beim Verlassen laeuft der aktuelle Durchlauf zu
 *     Ende, `ended` uebergibt dann normal weiter — kein Resume-
 *     Gedaechtnis noetig.
 *   - Klick/Tap springt die Staffel auf die Karte, laesst sie aber im
 *     Sequenz-Modus (fuer Touch-Geraete in Desktop-Breite: dort gibt es
 *     kein Hover-Ende, ein haengender Hover-Loop waere eine Sackgasse).
 *   - Verlaesst die Sektion den Viewport, resettet die Tour auf Karte 0
 *     — naechster Auftritt erzaehlt von vorn (wie die Mobile-Karten).
 *   - Play/Pause-Toggle pro Karte (VideoStage) bleibt Ueberstimme:
 *     Pause haelt die Staffel an (kein `ended`), Play setzt sie fort.
 */
export function FlowTabs() {
  const desktopRef = useRef<HTMLDivElement>(null);
  const isInView = useMostlyInView(desktopRef);

  const [active, setActive] = useState(0);
  const [source, setSource] = useState<"sequence" | "hover">("sequence");

  useEffect(() => {
    if (!isInView) {
      setActive(0);
      setSource("sequence");
    }
  }, [isInView]);

  const handleEnded = (index: number) => {
    // Nur die Staffel schaltet weiter — im Hover-Modus loopt das Video
    // und `ended` feuert gar nicht erst.
    if (source === "sequence" && index === active) {
      setActive((index + 1) % STEPS.length);
    }
  };

  return (
    <>
      {/* === DESKTOP === */}
      <div className="flow-desktop" ref={desktopRef}>
        {STEPS.map((s, i) => {
          const isCardActive = i === active && isInView;
          return (
            <article
              key={s.num}
              className="flow-card"
              data-active={isCardActive || undefined}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") {
                  setSource("hover");
                  setActive(i);
                }
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") setSource("sequence");
              }}
              onClick={() => setActive(i)}
            >
              <FlowCardMedia
                step={s}
                variant="desktop"
                isActive={isCardActive}
                loop={source === "hover" && i === active}
                onEnded={() => handleEnded(i)}
              />
              <div className="flow-card-text">
                <h3 className="flow-card-title">{s.title}</h3>
                <p className="flow-card-copy">{s.copy}</p>
                {s.link && (
                  <a className="flow-step-link" href={s.link.href}>
                    {s.link.label}
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* === MOBILE === */}
      <div className="flow-mobile" aria-label="Workflow steps">
        {STEPS.map((s) => (
          <MobileFlowCard key={s.num} step={s} />
        ))}
      </div>
    </>
  );
}

/**
 * Eine Karte im Mobile-Stack. Beobachtet ihre eigene Viewport-
 * Sichtbarkeit und spielt die Animation nur, waehrend die Karte
 * ueberwiegend sichtbar ist — beim Rausscrollen pausiert das Video
 * auf Frame 0 (macht VideoStage), beim Reinscrollen startet die
 * Story von vorn. 50%-Schwelle: die Media-Area sitzt oben in der
 * Karte und ist bei halber Kartensichtbarkeit bereits komplett im
 * Viewport, egal aus welcher Scroll-Richtung. Loop bleibt hier an
 * (FlowAnimation-Default) — es gibt keine Staffel auf Mobile.
 */
function MobileFlowCard({ step }: { step: Step }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useMostlyInView(ref);

  return (
    <article className="flow-card" ref={ref}>
      <FlowCardMedia step={step} variant="mobile" isActive={inView} />
      <div className="flow-card-text">
        <h3 className="flow-card-title">{step.title}</h3>
        <p className="flow-card-copy">{step.copy}</p>
        {step.link && (
          <a className="flow-step-link" href={step.link.href}>
            {step.link.label}
          </a>
        )}
      </div>
    </article>
  );
}

/**
 * Media-Bereich einer Flow-Karte — geteilt zwischen Desktop-Raster und
 * Mobile-Stack. Steps mit Video rendern FlowAnimation, Steps ohne den
 * Text-Placeholder (badge/label/desc).
 */
function FlowCardMedia({
  step,
  variant,
  isActive,
  loop,
  onEnded,
}: {
  step: Step;
  variant: "desktop" | "mobile";
  isActive: boolean;
  loop?: boolean;
  onEnded?: () => void;
}) {
  return (
    <div
      className="flow-card-media"
      data-has-animation={step.hasAnimation || undefined}
    >
      {step.hasAnimation ? (
        <FlowAnimation
          stepNum={step.num}
          variant={variant}
          isActive={isActive}
          loop={loop}
          onEnded={onEnded}
        />
      ) : (
        <>
          <span className="flow-card-badge">{step.badge}</span>
          <span className="flow-card-label">{step.label}</span>
          <span className="flow-card-desc">{step.desc}</span>
        </>
      )}
    </div>
  );
}
