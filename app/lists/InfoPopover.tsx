"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Kleines iOS-artiges Info-„?" mit Klick-Popover. Positioniert sich beim
 * Klick schlau: unter den Button, wenn dort mehr Platz ist, sonst
 * darueber (Auto-Flip an der aktuellen Scroll-Position); horizontal auf
 * den Button zentriert und an den Viewport-Rand geklemmt. Rendert per
 * Portal an <body> (position:fixed), damit kein Eltern-`overflow` es
 * abschneidet. Schliesst bei Aussenklick, Escape, Scroll und Resize —
 * die Position gilt fuer den Klick-Moment, danach lieber neu oeffnen.
 */

const POPOVER_W = 250;
const GAP = 8;
const MARGIN = 12;

interface Placement {
  top: number;
  left: number;
  width: number;
  below: boolean;
  caretLeft: number;
}

export function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function computePlacement(): Placement | null {
    const btn = btnRef.current;
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_W, vw - 2 * MARGIN);
    // Mehr Platz unten als oben → unten, sonst oben (Auto-Flip).
    const below = vh - r.bottom >= r.top;
    const centerX = r.left + r.width / 2;
    const left = Math.max(
      MARGIN,
      Math.min(centerX - width / 2, vw - width - MARGIN),
    );
    // Caret sitzt auf der Button-Mitte, aber innerhalb der Popover-Ecken.
    const caretLeft = Math.max(14, Math.min(centerX - left, width - 14));
    const top = below ? r.bottom + GAP : r.top - GAP;
    return { top, left, width, below, caretLeft };
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const p = computePlacement();
    if (p) {
      setPlace(p);
      setOpen(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Scroll in JEDEM Container faengt der Capture-Listener.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="lists-info-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
      >
        ?
      </button>
      {open &&
        place &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            role="tooltip"
            className={
              "lists-info-pop" + (place.below ? " is-below" : " is-above")
            }
            style={{
              top: place.top,
              left: place.left,
              width: place.width,
              transform: place.below ? undefined : "translateY(-100%)",
            }}
          >
            <span
              className="lists-info-caret"
              style={{ left: place.caretLeft }}
            />
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
