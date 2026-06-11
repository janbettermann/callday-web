import type { Metadata } from "next";
import { LangToggle } from "../../components/LangToggle";
import Content from "./content.mdx";

/**
 * /privacy — EN (Default).
 *
 * US ist Primärmarkt, App + Marketing-Site sind durchgehend Englisch —
 * deshalb ist EN die kanonische Privacy-Variante. Die deutsche
 * Übersetzung lebt unter /privacy/de und ist über den LangToggle im
 * Article-Body erreichbar.
 *
 * Siehe terms/page.tsx für die Begründung der page.tsx + content.mdx-
 * Aufteilung (Next 16 + React 19 inferieren MDX-Pages als Client, was
 * das Metadata-Export bricht).
 */

const CANONICAL = "https://callday.io/privacy";
const DE_URL = "https://callday.io/privacy/de";

export const metadata: Metadata = {
  title: "Privacy · Callday",
  description:
    "Privacy policy for the Callday website and the Callday iOS app.",
  alternates: {
    canonical: CANONICAL,
    languages: {
      en: CANONICAL,
      de: DE_URL,
      "x-default": CANONICAL,
    },
  },
};

export default function PrivacyPage() {
  return (
    <article className="legal-article" lang="en">
      <LangToggle current="en" />
      <Content />
    </article>
  );
}
