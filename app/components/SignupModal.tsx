"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { SignupForm } from "./SignupForm";
import { useSignupModalOpen, closeSignupModal } from "@/lib/use-signup-modal";

/**
 * Sign-up-Modal: der Hero-/Nav-„Get started"-CTA oeffnet dieses Popup mit dem
 * geteilten SignupForm, statt zur #signup-Sektion ganz unten zu scrollen —
 * faengt die Spitzen-Absicht direkt am Hero ab (Anti-Friktion).
 *
 * Rezept 1:1 vom PostComposer (app/affiliate/dashboard/PostComposer.tsx):
 * createPortal nach document.body (entkommt dem .container-Stacking-Context),
 * ESC-Close, Body-Scroll-Lock, Backdrop-Klick schliesst. Das Panel ist nur
 * Positionierung — die sichtbare Flaeche ist die .login-card des SignupForm
 * selbst (kein Card-in-Card). z-index 10000 schlaegt die z:9999-Nav.
 *
 * `slug` reist pro Landing durch (Affiliate-Attribution auf /a/[slug]); der
 * Store teilt nur den Open-Boolean. Success-Navigation (email/PW → /confirm,
 * OAuth → Redirect) macht der SignupForm selbst — kein onSuccess noetig.
 */
export function SignupModal({ slug }: { slug?: string }) {
  const open = useSignupModalOpen();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Fokus, der beim Schliessen wiederhergestellt wird (der ausloesende CTA).
    const restoreFocus = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSignupModal();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Fokus ins Modal ziehen (a11y), aber NICHT ins Email-Feld — das wuerde
    // auf Mobile sofort die Tastatur hochreissen und die OAuth-Buttons
    // verdecken. Panel-Container (tabIndex -1) fokussieren.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="signup-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign up"
      onClick={() => closeSignupModal()}
    >
      <div
        className="signup-modal-panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="signup-modal-close"
          aria-label="Close"
          onClick={() => closeSignupModal()}
        >
          ×
        </button>
        <SignupForm slug={slug} />
      </div>
    </div>,
    document.body,
  );
}
