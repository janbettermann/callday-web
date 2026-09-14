"use client";

import { useSyncExternalStore } from "react";

/**
 * Geteilter State fuer das Auth-Popup der Landings (Hero-CTA, Nav-CTA und
 * Nav-"Log in" oeffnen dasselbe Modal, nur in verschiedenen Modi).
 * Modul-scoped Store statt React-Context, spiegelt das Muster von
 * use-is-logged-in.ts. Kein Provider/Layout-Umbau noetig.
 *
 * `mode` entscheidet, welches Formular das Modal zeigt: "signup" (Default
 * fuer die CTAs) oder "login" (Nav-Link, oder der Wechsel im Popup).
 *
 * Ein gemountetes Modal registriert sich; die open-Funktionen melden
 * zurueck, ob jemand zuhoert. So kann ein Link ohne Modal auf der Seite
 * (z. B. Legal-Seiten mit SiteNav) sauber auf die Vollseite navigieren.
 *
 * Nur fuer AUSGELOGGTE Nutzer relevant: die CTAs oeffnen das Modal nur in
 * ihrem ausgeloggten Zweig (eingeloggt bleibt der Dashboard-Link).
 */

export type AuthModalMode = "signup" | "login";

interface State {
  open: boolean;
  mode: AuthModalMode;
}

let state: State = { open: false, mode: "signup" };
let mounted = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: State) {
  if (next.open === state.open && next.mode === state.mode) return;
  state = next;
  emit();
}

/** @returns true, wenn ein Modal gemountet ist und das Popup uebernimmt. */
export function openSignupModal(): boolean {
  if (mounted === 0) return false;
  setState({ open: true, mode: "signup" });
  return true;
}

/** @returns true, wenn ein Modal gemountet ist und das Popup uebernimmt. */
export function openLoginModal(): boolean {
  if (mounted === 0) return false;
  setState({ open: true, mode: "login" });
  return true;
}

export function closeSignupModal() {
  setState({ ...state, open: false });
}

/** Vom Modal beim Mount aufgerufen; gibt die Abmelde-Funktion zurueck. */
export function registerAuthModal(): () => void {
  mounted += 1;
  return () => {
    mounted -= 1;
  };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

const SERVER_STATE: State = { open: false, mode: "signup" };
function getServerSnapshot() {
  return SERVER_STATE;
}

export function useAuthModalState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
