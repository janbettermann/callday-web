"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  closeSignupModal,
  registerAuthModal,
  useAuthModalState,
} from "@/lib/use-signup-modal";

import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

/**
 * Auth-Popup der Landings. Der Hero-/Nav-"Get started"-CTA oeffnet es im
 * Sign-up-Modus (faengt die Spitzen-Absicht direkt am Hero ab), der Nav-
 * Link "Log in" im Login-Modus. Beide Formulare zeigen erst nur Apple und
 * Google, der E-Mail-Weg klappt per Link aus (Jan-Decision 2026-09-14);
 * der Wechsel zwischen Sign-up und Login laeuft ueber die Kopfzeile.
 *
 * Rezept 1:1 vom PostComposer: createPortal nach document.body (entkommt
 * dem .container-Stacking-Context), ESC-Close, Body-Scroll-Lock, Backdrop-
 * Klick schliesst. Das Panel ist nur Positionierung, die sichtbare Flaeche
 * ist die .login-card des jeweiligen Formulars. z-index 10000 schlaegt die
 * z:9999-Nav.
 *
 * `slug` reist pro Landing durch (Affiliate-Attribution auf /a/[slug]).
 * Success-Navigation machen die Formulare selbst; das Sign-up bekommt
 * hier `nextPath="/lists/new"` (Jan-Entscheidung 2026-09-15): der Hero-
 * CTA heisst "Build your first call list", also muss der Besucher nach
 * Apple/Google/E-Mail direkt im Generator stehen — der Umweg ueber das
 * Dashboard (dort nochmal "Get your first lead list") waere ein Tap, den
 * der Button nicht angekuendigt hat. Die Sign-up-Card in der #signup-
 * Sektion (BetaCta) landet weiterhin auf dem Dashboard-Default.
 */
export function SignupModal({ slug }: { slug?: string }) {
  const { open, mode } = useAuthModalState();
  const panelRef = useRef<HTMLDivElement>(null);

  // Anmelden, damit die Nav weiss, dass ein Popup uebernimmt (sonst
  // navigiert "Log in" auf die Vollseite).
  useEffect(() => registerAuthModal(), []);

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

    // Fokus ins Modal ziehen (a11y), aber NICHT ins Email-Feld, das wuerde
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
      aria-label={mode === "login" ? "Sign in" : "Sign up"}
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
        {mode === "login" ? (
          <LoginForm variant="modal" />
        ) : (
          <SignupForm slug={slug} oauthFirst nextPath="/lists/new" />
        )}
      </div>
    </div>,
    document.body,
  );
}
