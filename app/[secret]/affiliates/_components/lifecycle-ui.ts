import type { AffiliateLifecycle } from "@/lib/admin/affiliate-lifecycle";

import type { WbTone } from "../../_components/admin-ui";

/** Anzeige des Affiliate-Lifecycles: Label plus neutraler Punkt-Ton.
 *  Geteilt von Tabelle und Detail-Drawer (beide Client-Komponenten,
 *  deshalb hier statt in einer der beiden, sonst Import-Zirkel). */
export const LIFECYCLE: Record<AffiliateLifecycle, { label: string; tone: WbTone }> = {
  created: { label: "Angelegt", tone: "gray" },
  invited: { label: "Eingeladen", tone: "blue" },
  active_logged_in: { label: "Aktiv", tone: "green" },
  paused: { label: "Pausiert", tone: "amber" },
  removed: { label: "Entfernt", tone: "gray" },
};
