"use client";

import { useEffect } from "react";

/**
 * Client-Teil der Zoom-OAuth-Bounce. Reicht den von Zoom zurueckgegebenen
 * `code` (+ `state`) an die native App weiter, indem es zum registrierten
 * App-Scheme `dealswipe://oauth/zoom?...` navigiert.
 *
 * Warum client-seitig statt Next `redirect()`: ein Custom-Scheme ist kein
 * http(s)-Ziel — ein server-seitiger `Location: dealswipe://...` wird von
 * Browsern uneinheitlich behandelt. Der zuverlaessige Weg fuer App-Deep-Links
 * ist eine JS-Navigation + sichtbarer Fallback-Button.
 *
 * Im iOS-Flow laeuft diese Seite INNERHALB der ASWebAuthenticationSession
 * (die App oeffnet die Zoom-Authorize-URL via WebBrowser.openAuthSessionAsync
 * mit returnUrl = dealswipe://oauth/zoom). Die Session faengt die Navigation
 * zum dealswipe://-Scheme ab, schliesst sich und gibt der App code+state
 * zurueck — der Nutzer sieht diese Seite im Normalfall nur einen Wimpernschlag.
 * Auf Desktop/anderen Browsern passiert nichts automatisch; dort ist der
 * Button der Fallback.
 */
export function ZoomReturn({
  deepLink,
  hasError,
}: {
  deepLink: string | null;
  hasError: boolean;
}) {
  useEffect(() => {
    if (deepLink && !hasError) {
      window.location.replace(deepLink);
    }
  }, [deepLink, hasError]);

  if (hasError) {
    return (
      <div className="confirm-inner">
        <h1 className="confirm-headline">Zoom connection cancelled</h1>
        <p className="confirm-body">
          No problem. Head back to the Callday app on your iPhone and tap
          &ldquo;Connect Zoom&rdquo; again whenever you&apos;re ready.
        </p>
        <a href="dealswipe://" className="hero-cta confirm-cta">
          Open Callday
        </a>
      </div>
    );
  }

  if (!deepLink) {
    return (
      <div className="confirm-inner">
        <h1 className="confirm-headline">Nothing to connect here</h1>
        <p className="confirm-body">
          This page finishes connecting Zoom to the Callday app. Start the
          connection from Settings &rarr; Zoom inside the app.
        </p>
      </div>
    );
  }

  return (
    <div className="confirm-inner">
      <div className="confirm-icon">
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563E8"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
        </svg>
      </div>

      <h1 className="confirm-headline">Returning to Callday&hellip;</h1>

      <p className="confirm-body">
        Hang tight — we&apos;re sending you back to the app to finish
        connecting Zoom. If nothing happens, tap below.
      </p>

      <a href={deepLink} className="hero-cta confirm-cta">
        Open Callday
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1={5} y1={12} x2={19} y2={12} />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </a>

      <p className="confirm-note">
        This only works on the iPhone where you started connecting Zoom.
      </p>
    </div>
  );
}
