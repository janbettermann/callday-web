"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";

/**
 * Fired affiliate_signup_completed im OAuth-Path.
 *
 * /auth/callback haengt ?signup_completed_provider=apple|google an die
 * Redirect-URL, wenn ein frisches Affiliate-OAuth-Signup gerade
 * durchgelaufen ist (attachAffiliateAttribution returned true). Wir
 * lesen den Query-Param, feuern das Posthog-Event genau einmal und
 * ueberlassen das URL-Cleanup dem User (oder Posthog-Filter auf
 * `affiliate_signup_completed`-Event-Count).
 *
 * Email/PW-Pfad feuert das Event direkt in AffiliateSignupForm — diese
 * Komponente ist ausschliesslich fuer OAuth.
 */

interface Props {
  slug?: string | null;
}

export function PostHogSignupCompletion({ slug }: Props) {
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const provider = searchParams.get("signup_completed_provider");
    if (provider !== "apple" && provider !== "google") return;
    firedRef.current = true;
    posthog?.capture("affiliate_signup_completed", {
      slug: slug ?? null,
      auth_provider: provider,
    });
  }, [searchParams, posthog, slug]);

  return null;
}
