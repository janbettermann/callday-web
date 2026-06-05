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
    copy: "One lead per card. Tap to call, tap to log — the next lead's already there. Every dial counts, even the no's.",
    badge: "Animation 02",
    label: "The calling loop",
    desc: "One lead card: tap to call, tap the outcome, the next card slides in — a counter ticks up on every dial.",
  },
  {
    num: "03",
    title: "Booked in two taps",
    copy: "Meeting? Two taps, and the calendar event and confirmation email fire before the next lead lands.",
    badge: "Animation 03",
    label: "Booked. Synced. Sent.",
    desc: "A booked meeting cascades into a calendar event and a confirmation email — auto-fired before the next lead.",
  },
];

const ROTATE_MS = 6000;

/**
 * The 3-step flow section.
 *
 * Structure: one `.flow-layout` with two siblings — a `.flow-tablist`
 * holding the 3 tabs and a `.flow-stage` holding the 3 animation
 * cards. Each step's tab and anim carry a matching `data-step` index
 * so CSS can pair them when the layout flips on mobile.
 *
 *   Desktop (>960 px): the layout is a 2-column CSS Grid. The tablist
 *   is a packed flex column in column 1; the stage is a portrait
 *   box (aspect-ratio 4/5) in column 2 with the 3 anims absolutely
 *   positioned on top of each other. Only the active one is
 *   opacity:1. Auto-rotates every 6 s; first user click on a tab
 *   stops the rotation for the session.
 *
 *   Mobile (≤960 px): both wrappers (`.flow-tablist` and
 *   `.flow-stage`) drop to `display: contents`, so their children
 *   become direct flex children of `.flow-layout`. CSS `order` keyed
 *   on `data-step` then interleaves them — tab1, anim1, tab2, anim2,
 *   tab3, anim3 — and every anim is fully visible (opacity:1,
 *   position: static). Tabs lose their interactive look and become
 *   simple headers above each animation card.
 *
 * `prefers-reduced-motion: reduce` is respected: no auto-rotate, no
 * crossfade transition.
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

  return (
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
              data-step={i}
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
              data-step={i}
              data-active={active || undefined}
              role="img"
              aria-label={`${s.label} — animation placeholder`}
            >
              <span className="flow-anim-badge">{s.badge}</span>
              <span className="flow-anim-label">{s.label}</span>
              <span className="flow-anim-desc">{s.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
