"use client";

import { useEffect, useRef, useState } from "react";

type Step = {
  num: string;
  title: string;
  copy: string;
  badge: string;
  label: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Drop in your list",
    copy: "CSV or Excel in. Ready in under a minute — no setup, no system to build.",
    badge: "Animation 01",
    label: "Drag & drop import",
    desc: "An Excel file drops into the import zone and becomes a lead list that joins your stack of audiences.",
  },
  {
    num: "02",
    title: "Get into the rhythm",
    copy: "One lead per card. Tap to call, tap to log — the next lead's already there.",
    badge: "Animation 02",
    label: "The calling loop",
    desc: "One lead card: tap to call, tap the outcome, the next card slides in. A counter ticks up on every dial.",
  },
  {
    num: "03",
    title: "Booked in two taps",
    copy: "Meeting? Two taps, calendar event + confirmation email fire before the next lead lands.",
    badge: "Animation 03",
    label: "Booked. Synced. Sent.",
    desc: "A booked meeting cascades into a calendar event and a confirmation email, auto-fired before the next lead.",
  },
];

const ROTATE_MS = 6000;

/**
 * The 3-step flow section.
 *
 * Two completely separate DOM trees, one for each breakpoint — much
 * simpler than trying to make a single tree morph between two very
 * different shapes:
 *
 *   Desktop (>960 px) — `.flow-layout`:
 *     2-column grid. Left column is `.flow-tablist` (3 packed tabs).
 *     Right column is `.flow-stage` (3 dashed-stripe anim placeholders,
 *     absolutely stacked, only the active one opacity:1). Auto-rotates
 *     every 6 s; first user click stops the rotation for the session.
 *
 *   Mobile (≤960 px) — `.flow-mobile`:
 *     A single carousel of 3 white cards, each with a cream media area
 *     (badge + placeholder + prev/next arrows) on top and a text area
 *     (title + copy + pagination dots) below. Cards stack in one grid
 *     cell; only the active one is opacity:1. Arrows clamp at the
 *     edges (no wrap), but auto-rotate keeps wrapping until the first
 *     arrow tap.
 *
 * CSS toggles the two wrappers via `display: none` so only one is
 * laid out at a time. `prefers-reduced-motion: reduce` is respected:
 * no auto-rotate, no crossfade transition.
 */
export function FlowTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userTookOver, setUserTookOver] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (userTookOver || reduceMotion.current) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % STEPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [userTookOver]);

  const handleSelect = (i: number) => {
    setActiveIndex(i);
    setUserTookOver(true);
  };

  const handlePrev = () => {
    if (activeIndex === 0) return;
    handleSelect(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex === STEPS.length - 1) return;
    handleSelect(activeIndex + 1);
  };

  // Keyboard fallback for the mobile arrow buttons. We drive the arrows
  // off `onPointerUp` (most reliable for cross-input — fires on mouse,
  // touch, and pen) rather than `onClick`, which on iOS Safari is
  // sometimes synthesized late or dropped entirely for small absolutely
  // positioned buttons. `onPointerUp` skips the synthesis hop. Trade-off
  // is that keyboard activation (Enter/Space on the focused button)
  // wouldn't fire `pointerup`, so we re-add it explicitly here.
  const handleKey =
    (action: () => void) =>
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        action();
      }
    };

  return (
    <>
      {/* === DESKTOP === */}
      <div className="flow-layout">
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
                role="img"
                aria-label={`${s.label}, animation placeholder`}
              >
                <span className="flow-anim-badge">{s.badge}</span>
                <span className="flow-anim-label">{s.label}</span>
                <span className="flow-anim-desc">{s.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* === MOBILE === */}
      <div
        className="flow-mobile"
        role="region"
        aria-label="Workflow steps"
        aria-roledescription="carousel"
      >
        <div className="flow-cards">
          {STEPS.map((s, i) => {
            const active = i === activeIndex;
            return (
              <article
                key={s.num}
                className="flow-card"
                data-active={active || undefined}
                aria-hidden={!active}
              >
                <div className="flow-card-media">
                  <span className="flow-card-badge">{s.badge}</span>
                  <span className="flow-card-label">{s.label}</span>
                  <span className="flow-card-desc">{s.desc}</span>
                </div>
                <div className="flow-card-text">
                  <h3 className="flow-card-title">{s.title}</h3>
                  <p className="flow-card-copy">{s.copy}</p>
                  <div className="flow-card-dots" aria-hidden="true">
                    {STEPS.map((_, j) => (
                      <span
                        key={j}
                        className="flow-card-dot"
                        data-active={j === activeIndex || undefined}
                      />
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Arrows live OUTSIDE the card stack so they never sit under
            an inactive-but-stacked card. Positioned absolute over the
            media area via .flow-mobile's relative container. */}
        <button
          type="button"
          className="flow-card-nav flow-card-nav-prev"
          onPointerUp={handlePrev}
          onKeyDown={handleKey(handlePrev)}
          disabled={activeIndex === 0}
          aria-label="Previous step"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          type="button"
          className="flow-card-nav flow-card-nav-next"
          onPointerUp={handleNext}
          onKeyDown={handleKey(handleNext)}
          disabled={activeIndex === STEPS.length - 1}
          aria-label="Next step"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}
