"use client";

import { useSyncExternalStore } from "react";

/**
 * Geteilter Open-State fuer das Sign-up-Modal (Hero-CTA + Nav-CTA oeffnen
 * dasselbe Popup). Modul-scoped Store statt React-Context — spiegelt das
 * etablierte Muster von use-is-logged-in.ts (den sich dieselben CTAs schon
 * teilen). Kein Provider/Layout-Umbau noetig.
 *
 * Nur fuer AUSGELOGGTE Nutzer relevant: die CTAs oeffnen das Modal nur in
 * ihrem ausgeloggten Zweig (eingeloggt bleibt der Dashboard-Link).
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openSignupModal() {
  if (open) return;
  open = true;
  emit();
}

export function closeSignupModal() {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return open;
}

function getServerSnapshot() {
  return false;
}

export function useSignupModalOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
