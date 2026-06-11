import type { Metadata } from "next";
import { LangToggle } from "../../../components/LangToggle";
import Content from "./content.mdx";

/**
 * /privacy/de — deutsche Privacy-Variante.
 *
 * EN ist Default unter /privacy (US-Primärmarkt). DE lebt als Sub-Route,
 * der LangToggle im Article-Body wechselt zwischen beiden.
 */

const CANONICAL = "https://callday.io/privacy/de";
const EN_URL = "https://callday.io/privacy";

export const metadata: Metadata = {
  title: "Datenschutz · Callday",
  description:
    "Datenschutzerklärung für die Callday-Webseite und die Callday-iOS-App.",
  alternates: {
    canonical: CANONICAL,
    languages: {
      en: EN_URL,
      de: CANONICAL,
      "x-default": EN_URL,
    },
  },
};

export default function PrivacyDePage() {
  return (
    <article className="legal-article" lang="de">
      <LangToggle current="de" />
      <Content />
    </article>
  );
}
