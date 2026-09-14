"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { WbIcon } from "./werkbank";

/**
 * Modal im Werkbank-Design. Portal auf document.body (damit kein
 * position:fixed tief im Baum in einer Stacking-Context-Falle landet),
 * Desktop zentriert, Mobile als Bottom-Sheet (werkbank.css). Schliesst
 * bei Backdrop-Klick und Escape, sperrt den Body-Scroll solange offen.
 *
 * `wb-scope` traegt die Design-Tokens, weil das Portal ausserhalb des
 * `.wb`-Wurzelelements der Seite haengt.
 */
export function WbModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="wb-scope wb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="wb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-head">
          <h2 className="wb-panel-title">{title}</h2>
          <button type="button" onClick={onClose} className="wb-icon-btn" aria-label="Close">
            <WbIcon name="close" size={16} />
          </button>
        </div>
        <div className="wb-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
