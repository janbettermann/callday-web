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
   * Wenn true, ersetzt das Lottie-Asset (FlowAnimation) den Text-Placeholder
   * — Desktop + Mobile gleichermassen. Steps ohne Lottie bekommen weiter
   * den label+desc-Placeholder. So koennen Animationen einzeln nachgereicht
   * werden ohne den ganzen Block umzubauen.
   */
  hasAnimation?: boolean;
  /**
   * Optionaler Link unter der Copy (Desktop: unter dem Tab, Mobile: unter
   * dem Karten-Text). Auf Desktop lebt er ausserhalb des Tab-<button>s —
   * ein <a> im <button> waere invalides HTML.
   */
  link?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Start with any list",
    copy: "Drop in any CSV or Excel. Ready in under a minute — no setup, no system to build.",
    badge: "Animation 01",
    label: "Drag & drop import",
    desc: "An Excel file drops into the import zone and becomes a lead list that joins your stack of audiences.",
    hasAnimation: true,
    // Ziel-Page (/first-list: Guide + Prompt-Generator) existiert noch
    // nicht — href bleibt bewusst tot, bis die Page steht.
    link: { label: "Where to get a list", href: "#" },
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
    copy: "Meeting? Two taps, calendar event + confirmation email fire before the next lead lands.",
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
 *   Desktop (>960 px) — `.flow-layout`:
 *     2-column grid. Left column is `.flow-tablist` (3 packed tabs).
 *     Right column is `.flow-stage` (3 anim slots, absolutely stacked,
 *     only the active one opacity:1). KEINE Auto-Rotation mehr
 *     (entfernt 2026-07-05): der Step wechselt nur per Klick —
 *     gleiches Produktprinzip wie beim Mobile-Karussell-Removal,
 *     "nichts bewegt sich ohne bewussten Tap".
 *
 *   Mobile (≤960 px) — `.flow-mobile`:
 *     A vertical stack of 3 white cards, all visible at once — scroll
 *     is the only navigation. Kein Karussell mehr (war vorher eins):
 *     Auto-Advance riss den Leser mitten im Satz zur naechsten Karte,
 *     und die Card+Dots-Optik weckte eine Swipe-Erwartung, die nie
 *     implementiert war — beides Verstoesse gegen das Produktprinzip
 *     "nichts bewegt sich ohne bewussten Tap". Jede Karte spielt ihre
 *     Animation, solange sie ueberwiegend im Viewport steht
 *     (eigener IntersectionObserver pro Karte, siehe MobileFlowCard).
 *
 * CSS toggles the two wrappers via `display: none` so only one is
 * laid out at a time. `prefers-reduced-motion: reduce` wird in
 * FlowAnimation respektiert: Videos bleiben auf Frame 0 pausiert.
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

export function FlowTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const desktopRef = useRef<HTMLDivElement>(null);

  /**
   * Spielt die aktive Animation nur ab, waehrend der Desktop-Tree im
   * Viewport sichtbar ist. Verlaesst der User die Sektion, pausiert
   * das Video auf Frame 0; kommt er wieder rein, startet es von vorn.
   * Die Step-Auswahl selbst bleibt erhalten — sie wechselt nur per
   * Klick, nie automatisch.
   *
   * Nur der Desktop-Tree wird beobachtet — auf Mobile ist er
   * display:none und misst hoehe 0. Die Mobile-Karten steuern ihre
   * Sichtbarkeit selbst (eigener Hook pro Karte in MobileFlowCard).
   * 50%-Schwelle: empirischer Sweet-Spot, bei dem die rechte
   * Animations-Spalte garantiert vollstaendig sichtbar ist bevor wir
   * play druecken.
   */
  const isInView = useMostlyInView(desktopRef);

  const handleSelect = (i: number) => {
    setActiveIndex(i);
  };

  return (
    <>
      {/* === DESKTOP === */}
      <div className="flow-layout" ref={desktopRef}>
        <ol
          className="flow-tablist"
          role="tablist"
          aria-label="Workflow steps"
        >
          {STEPS.map((s, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={s.num}
                className="flow-tab-item"
                data-active={active || undefined}
              >
                <button
                  type="button"
                  className="flow-tab"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelect(i)}
                >
                  <span className="flow-tab-head">
                    <span className="flow-tab-num">{s.num}</span>
                    <span className="flow-tab-title">{s.title}</span>
                  </span>
                  <span className="flow-tab-copy">{s.copy}</span>
                </button>
                {s.link && (
                  <a
                    className="flow-step-link flow-tab-link"
                    href={s.link.href}
                    onClick={(e) => e.preventDefault()}
                  >
                    {s.link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ol>

        <div className="flow-stage">
          {STEPS.map((s, i) => {
            const active = i === activeIndex;
            return (
              <div
                key={s.num}
                className="flow-anim"
                data-active={active || undefined}
                data-has-animation={s.hasAnimation || undefined}
                // role="img" nur fuer den Text-Placeholder: Es flacht den
                // Subtree fuer Screenreader ab — auf Animations-Steps
                // wuerde es den Play/Pause-Toggle unerreichbar machen.
                // Das dekorative Video ist eh aria-hidden.
                {...(s.hasAnimation
                  ? {}
                  : {
                      role: "img" as const,
                      "aria-label": `${s.label}, animation placeholder`,
                    })}
              >
                {s.hasAnimation ? (
                  <FlowAnimation
                    stepNum={s.num}
                    isActive={active && isInView}
                  />
                ) : (
                  <>
                    <span className="flow-anim-badge">{s.badge}</span>
                    <span className="flow-anim-label">{s.label}</span>
                    <span className="flow-anim-desc">{s.desc}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
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
 * Viewport, egal aus welcher Scroll-Richtung.
 */
function MobileFlowCard({ step }: { step: Step }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useMostlyInView(ref);

  return (
    <article className="flow-card" ref={ref}>
      <div
        className="flow-card-media"
        data-has-animation={step.hasAnimation || undefined}
      >
        {step.hasAnimation ? (
          <FlowAnimation stepNum={step.num} isActive={inView} />
        ) : (
          <>
            <span className="flow-card-badge">{step.badge}</span>
            <span className="flow-card-label">{step.label}</span>
            <span className="flow-card-desc">{step.desc}</span>
          </>
        )}
      </div>
      <div className="flow-card-text">
        <h3 className="flow-card-title">{step.title}</h3>
        <p className="flow-card-copy">{step.copy}</p>
        {step.link && (
          <a
            className="flow-step-link"
            href={step.link.href}
            onClick={(e) => e.preventDefault()}
          >
            {step.link.label}
          </a>
        )}
      </div>
    </article>
  );
}
