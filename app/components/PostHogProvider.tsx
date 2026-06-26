"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { ReactNode } from "react";

/**
 * Posthog-Wrapper fuer das App-Layout.
 *
 * Affiliate-Programm Phase 1 — Funnel-Tracking via drei Events:
 *   affiliate_landing_view     onMount in /a/[slug]
 *   affiliate_signup_started   bei erster Form-Interaktion
 *   affiliate_signup_completed nach erfolgreichem signUp
 *
 * Wenn NEXT_PUBLIC_POSTHOG_KEY nicht gesetzt ist (z.B. lokale Dev-Env
 * ohne Posthog), rendern wir die Children direkt ohne Provider —
 * usePostHog() liefert dann undefined, capture()-Calls werden geguarded.
 *
 * person_profiles='identified_only' = wir tracken anonyme Events, aber
 * lege Person-Profile erst an wenn identify() laeuft. Spart Posthog-MAU.
 *
 * Beim Posthog-Setup auf dem callday.io-Projekt darauf achten dass
 * Person-IPs gemasked sind (Disable IP collection in Project-Settings).
 */

interface Props {
  children: ReactNode;
}

export function PostHogProvider({ children }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <PHProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
      }}
    >
      {children}
    </PHProvider>
  );
}
