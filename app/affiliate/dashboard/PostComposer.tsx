"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import { AddPostForm } from "./AddPostForm";

const triggerStyle: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "var(--blue-deep)",
  border: "none",
  color: "#ffffff",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  boxShadow: "0 2px 8px rgba(37, 99, 232, 0.25)",
};

/**
 * Post-Composer im Affiliate-Dashboard. Ein „+" oben rechts in der Posts-Card
 * öffnet das Eingabeformular als Overlay — auf Desktop ein zentriertes Modal,
 * auf Mobile ein Bottom-Sheet (Positionierung + Animation via `.pc-*`-Klassen
 * in globals.css). So nimmt die Eingabe im Ruhezustand keinen Platz weg.
 *
 * Schliesst per Backdrop-Klick, Escape und nach erfolgreichem Anlegen
 * (onSuccess aus AddPostForm). Body-Scroll wird gesperrt solange offen.
 */
export function PostComposer({ windowHours }: { windowHours: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add a post"
        style={triggerStyle}
      >
        +
      </button>

      {open
        ? createPortal(
            <div
              className="pc-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Add a post"
              onClick={() => setOpen(false)}
            >
              <div className="pc-panel" onClick={(e) => e.stopPropagation()}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-0.3px",
                      color: "var(--ink)",
                    }}
                  >
                    Add a post
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    style={{
                      width: 30,
                      height: 30,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      color: "var(--ink-faint)",
                      fontSize: 22,
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <p
                  style={{
                    margin: "0 0 20px",
                    fontSize: 13,
                    color: "var(--ink-dim)",
                    lineHeight: 1.5,
                  }}
                >
                  Log a post to see how many visitors and sign-ups came in the{" "}
                  {windowHours} h after it.
                </p>

                <AddPostForm onSuccess={() => setOpen(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
