"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";

/**
 * Bindet die Posthog-distinct-id an die Supabase-User-id.
 *
 * Hintergrund: PostHogProvider laeuft mit `person_profiles: "identified_only"`
 * (siehe app/components/PostHogProvider.tsx). Das spart Posthog-MAU, hat
 * aber als Side-Effect dass anonyme Events KEINE Person-Profile erzeugen —
 * Funnel-Aggregationen ueber den OAuth-Round-Trip verlieren ihre Identitaet
 * und Cross-Step-Zuordnung (landing → started → completed) ist unzuverlaessig.
 *
 * Identify auf /account verbindet die anonymen Events der laufenden Session
 * retroaktiv mit dem nun bekannten User. Posthog macht intern alias()
 * automatisch, daher reicht identify() — die landing_view + started + (bei
 * Email/PW auch) completed Events vor dem Login bekommen die richtige
 * Person-Zuordnung.
 *
 * Idempotent gegen Re-Mounts via ref, damit Posthog nicht bei jedem
 * /account-Render erneut identify-Calls feuert.
 */

interface Props {
  userId: string;
  email: string | null;
}

export function PostHogIdentifier({ userId, email }: Props) {
  const posthog = usePostHog();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;
    if (identifiedRef.current === userId) return;
    identifiedRef.current = userId;
    posthog.identify(userId, email ? { email } : undefined);
  }, [posthog, userId, email]);

  return null;
}
