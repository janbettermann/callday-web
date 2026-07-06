"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "./supabase-browser";

/**
 * Client-seitiger Login-Check fuer die auth-abhaengigen Landing-Elemente
 * (Header-CTA, Hero-CTA, #beta-Karte). getSession() liest die Session aus
 * dem Cookie ohne Netzwerk-Roundtrip, damit die Landing statisch bleibt.
 *
 * Ein geteilter In-Flight-Promise dedupt die gleichzeitigen Mounts beim
 * Seitenaufbau auf EINEN getSession-Call, und alle Consumer flippen synchron
 * (statt drei unabhaengiger Checks + Mikro-Flicker). Nach dem Resolve wird
 * der Promise zurueckgesetzt, damit spaetere Mounts frisch pruefen — kein
 * stale-Cache nach Login/Logout.
 */
let inflight: Promise<boolean> | null = null;

function checkSession(): Promise<boolean> {
  if (!inflight) {
    inflight = createSupabaseBrowser()
      .auth.getSession()
      .then(({ data }) => !!data.session)
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useIsLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    checkSession().then((value) => {
      if (active) setLoggedIn(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return loggedIn;
}
