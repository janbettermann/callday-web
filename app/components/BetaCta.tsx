"use client";

import { useEffect, useState } from "react";
import { SignupForm } from "./SignupForm";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * #beta-Sektion auf den Landings (organic + /a/[slug]).
 *
 * Ausgeloggt: das Sign-up-Formular. Eingeloggte Rueckkehrer haben sich
 * schon registriert — fuer sie eine "You're already in"-Karte, die zum
 * Account (Install + Verwaltung) fuehrt, statt sie nochmal zur Anmeldung
 * aufzufordern (das waere redundant + leicht irrefuehrend).
 *
 * Auth-Check client-seitig via getSession (liest die Session aus dem
 * Cookie, kein Netzwerk), damit die Landing statisch bleibt. Default =
 * ausgeloggt (99% der Besucher); der seltene eingeloggte Rueckkehrer sieht
 * nach dem Session-Read einen kurzen Swap. Gleiches Pattern wie SiteNav.
 *
 * `slug` wird nur ans SignupForm durchgereicht (Affiliate-Attribution) —
 * fuer den eingeloggten Zweig irrelevant.
 */
export function BetaCta({ slug }: { slug?: string }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    createSupabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setLoggedIn(!!data.session);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <h2>
        {loggedIn ? (
          "Welcome back."
        ) : (
          <>
            Get <span className="accent">early access.</span>
          </>
        )}
      </h2>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {loggedIn ? (
          <div className="login-card">
            <h3 className="login-card-title">You&apos;re already in.</h3>
            <p className="login-card-sub">
              Continue to your account to get the app and start calling.
            </p>
            <a
              href="/account"
              className="beta-submit"
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Go to your account
            </a>
          </div>
        ) : (
          <SignupForm slug={slug} />
        )}
      </div>
    </>
  );
}
