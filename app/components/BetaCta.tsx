"use client";

import { SignupForm } from "./SignupForm";
import { useIsLoggedIn } from "@/lib/use-is-logged-in";

/**
 * #signup-Sektion auf den Landings (organic + /a/[slug]).
 *
 * Ausgeloggt: das Sign-up-Formular. Eingeloggte Rueckkehrer haben sich
 * schon registriert — fuer sie eine "You're already in"-Karte, die zum
 * Dashboard fuehrt, statt sie nochmal zur Anmeldung aufzufordern (das
 * waere redundant + leicht irrefuehrend).
 *
 * Login-Check via geteiltem useIsLoggedIn-Hook (ein getSession fuer alle
 * Landing-Swaps, Landing bleibt statisch). Default = ausgeloggt (99% der
 * Besucher); der seltene eingeloggte Rueckkehrer sieht nach dem Session-Read
 * einen kurzen Swap.
 *
 * `slug` wird nur ans SignupForm durchgereicht (Affiliate-Attribution) —
 * fuer den eingeloggten Zweig irrelevant.
 */
export function BetaCta({ slug }: { slug?: string }) {
  const loggedIn = useIsLoggedIn();

  return (
    <>
      <h2>
        {loggedIn ? (
          "Welcome back."
        ) : (
          <>
            Get <span className="accent">started.</span>
          </>
        )}
      </h2>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {loggedIn ? (
          <div className="login-card">
            <h3 className="login-card-title">You&apos;re already in.</h3>
            <p className="login-card-sub">
              Continue to your dashboard to keep calling.
            </p>
            <a
              href="/dashboard"
              className="beta-submit"
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Go to your dashboard
            </a>
          </div>
        ) : (
          <SignupForm slug={slug} />
        )}
      </div>
    </>
  );
}
