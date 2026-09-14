"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Ziel = das URL-Scheme der App (`dealswipe://`, app.json im App-Repo).
 * NICHT `callday://` — das ist nirgends registriert, so ein Link tut auf
 * dem iPhone schlicht nichts (der Stand bis 2026-09-14).
 */
const APP_CONFIRMED_URL = "dealswipe://auth/confirmed";

/**
 * "Open Callday"-Button auf /auth/confirmed. Traegt das URL-Fragment
 * (#access_token=…&refresh_token=…&type=signup) weiter, falls Supabase eins
 * mitgeschickt hat: die App liest es in utils/auth/deep-link.ts und setzt
 * daraus die Session — der User ist dann direkt eingeloggt. Ohne Fragment
 * oeffnet der Link die App nur; der Hinweis unter dem Button deckt das ab.
 *
 * Client-Komponente, weil das Fragment den Server nie erreicht. Bis zur
 * Hydration steht der nackte Scheme-Link im Markup (funktioniert auch).
 */
export function OpenAppLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState(APP_CONFIRMED_URL);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length > 1) setHref(APP_CONFIRMED_URL + hash);
  }, []);

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
