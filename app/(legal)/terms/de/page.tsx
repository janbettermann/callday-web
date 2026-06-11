import type { Metadata } from "next";
import { LangToggle } from "../../../components/LangToggle";
import Content from "./content.mdx";

/**
 * /terms/de — deutsche Terms-Variante. EN ist Default unter /terms.
 */

const CANONICAL = "https://callday.io/terms/de";
const EN_URL = "https://callday.io/terms";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen · Callday",
  description:
    "Nutzungsbedingungen für die Callday-iOS-App und die zugehörige Webseite.",
  alternates: {
    canonical: CANONICAL,
    languages: {
      en: EN_URL,
      de: CANONICAL,
      "x-default": EN_URL,
    },
  },
};

export default function TermsDePage() {
  return (
    <article className="legal-article" lang="de">
      <LangToggle current="de" />
      <Content />
    </article>
  );
}
