"use client";

import { useEffect } from "react";

import { initLpContext, trackLpEvent } from "@/lib/lp/client";
import type { LpPage } from "@/lib/lp/shared";

/**
 * Unsichtbarer Client-Baustein auf den Landings: uebernimmt die server-
 * seitige Varianten-Zuweisung in den Client-Store (lib/lp/client.ts) und
 * schickt das view-Event. Rendert nichts.
 *
 * Bewusst client-seitig statt eines Server-Inserts beim Render: so zaehlen
 * nur Besucher, die die Seite tatsaechlich ausgefuehrt haben — Router-
 * Prefetches, Link-Previews und Crawler ohne JS fallen von selbst raus.
 */
export function LpSession({
  page,
  experiment,
  variant,
  overridden,
}: {
  page: LpPage;
  experiment: string | null;
  variant: string | null;
  overridden: boolean;
}) {
  useEffect(() => {
    initLpContext({ page, experiment, variant, overridden });
    trackLpEvent("view");
  }, [page, experiment, variant, overridden]);

  return null;
}
