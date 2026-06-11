import type { Metadata } from "next";
import { LangToggle } from "../../components/LangToggle";
import Content from "./content.mdx";

/**
 * /terms — EN (Default).
 *
 * Begruendung der page.tsx + content.mdx-Aufteilung: Next 16 + React 19
 * inferieren MDX-Pages als Client-Components, weil der Compiler-Output
 * `useMDXComponents` importiert und React den `use`-Prefix als Hook
 * erkennt (Client-only). Client-Components duerfen `metadata` nicht
 * exportieren → Build-Error. Workaround: page.tsx als
 * Server-Component-Shell, MDX als Child-Content. Metadata lebt hier,
 * der MDX-Inhalt bleibt unveraendert.
 *
 * Deutsche Variante: /terms/de — Toggle im Article-Body.
 */

const CANONICAL = "https://callday.io/terms";
const DE_URL = "https://callday.io/terms/de";

export const metadata: Metadata = {
  title: "Terms · Callday",
  description:
    "Terms of Service for the Callday iOS app and the associated website.",
  alternates: {
    canonical: CANONICAL,
    languages: {
      en: CANONICAL,
      de: DE_URL,
      "x-default": CANONICAL,
    },
  },
};

export default function TermsPage() {
  return (
    <article className="legal-article" lang="en">
      <LangToggle current="en" />
      <Content />
    </article>
  );
}
