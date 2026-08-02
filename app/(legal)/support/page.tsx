import type { Metadata } from "next";
import Content from "./content.mdx";

/**
 * /support — Support-Seite (EN).
 *
 * Pflicht-Dokument für den Zoom-Marketplace-App-Listing ("Support URL"):
 * eine Seite auf eigener Domain, über die Nutzer direkten Support vom
 * Team bekommen. Verweist für Integrations-Details auf /zoom und für
 * Daten-Themen auf /privacy.
 *
 * Aufbau analog zu /zoom: (legal)-Route-Group fürs Layout, page.tsx +
 * content.mdx-Split wegen des Metadata-Exports, EN-only.
 */

const CANONICAL = "https://callday.io/support";

export const metadata: Metadata = {
  title: "Callday · Support",
  description:
    "Get help with Callday — contact the team, Zoom integration guide, account and billing questions.",
  alternates: { canonical: CANONICAL },
};

export default function SupportPage() {
  return (
    <article className="legal-article" lang="en">
      <Content />
    </article>
  );
}
