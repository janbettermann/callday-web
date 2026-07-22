/**
 * Shared Plumbing fuer den Sign-up-Confirm-Flow (SignupForm → /confirm).
 *
 * Die Email wandert bewusst via sessionStorage statt Query-Param zur
 * /confirm-Seite — ein Query-Param wuerde die Email (PII) in Vercel-Logs,
 * Analytics und Browser-History leaken. sessionStorage ist per-Tab und
 * ueberlebt Reloads; landet der User ohne Handoff auf /confirm (frischer
 * Tab, direkter Aufruf, Storage blockiert), zeigt die Seite ein
 * Email-Fallback-Feld (siehe ConfirmCard).
 */

export const SIGNUP_CODE_LENGTH = 8;

const STORAGE_KEY = "callday.signup-confirm";

/**
 * "welcome-back" = User war schon registriert (Tab vorher geschlossen,
 * Code nie eingegeben). In dem Fall wurde bewusst KEIN frischer Code
 * getriggert (Supabase-Rate-Limit, wenn der Original-Code grade erst
 * rausging) — die Copy weist auf den Resend-Button hin.
 */
export type SignupConfirmVariant = "fresh" | "welcome-back";

export interface SignupConfirmHandoff {
  email: string;
  variant: SignupConfirmVariant;
  /**
   * Interner Pfad, auf dem der User nach erfolgreichem Confirm landet.
   * Gesetzt von Einstiegen mit eigenem Funnel (z. B. /lists); ohne Wert
   * gilt der Default /dashboard (siehe ConfirmCard).
   */
  next?: string;
}

export function writeSignupConfirmHandoff(handoff: SignupConfirmHandoff) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    // Storage blockiert (Private-Mode-Edge-Cases) → /confirm faellt auf
    // das Email-Feld zurueck, der Flow bleibt funktional.
  }
}

export function readSignupConfirmHandoff(): SignupConfirmHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupConfirmHandoff>;
    if (typeof parsed.email !== "string" || !parsed.email) return null;
    return {
      email: parsed.email,
      variant: parsed.variant === "welcome-back" ? "welcome-back" : "fresh",
      // Nur interne Pfade — schuetzt gegen Open-Redirects, falls der
      // sessionStorage-Wert manipuliert wurde.
      next:
        typeof parsed.next === "string" && parsed.next.startsWith("/")
          ? parsed.next
          : undefined,
    };
  } catch {
    return null;
  }
}

export function clearSignupConfirmHandoff() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // s.o. — nicht kritisch.
  }
}

/**
 * TestFlight-Invite-Mail nach abgeschlossenem Sign-Up. Fire-and-forget —
 * Failures sind nicht kritisch fuer den Flow, /account hat einen
 * Resend-Button als Recovery-Pfad. Der Server liest die Ziel-Email aus
 * der SSR-Session (kein Body noetig).
 */
export async function sendTestflightInviteMail(context: string) {
  try {
    await fetch("/api/testflight-invite", { method: "POST" });
  } catch (err) {
    console.error(`[${context}] post-signup mail failed`, err);
  }
}
