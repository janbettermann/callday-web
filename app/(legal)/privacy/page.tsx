import type { Metadata } from "next";
import Content from "./content.mdx";

/**
 * /privacy — Wrapper-Page für content.mdx.
 *
 * Siehe terms/page.tsx für die Begründung der page.tsx + content.mdx-
 * Aufteilung (Next 16 + React 19 inferieren MDX-Pages als Client, was
 * das Metadata-Export bricht).
 */

export const metadata: Metadata = {
  title: "Datenschutz · Callday",
  description:
    "Datenschutzerklärung für die Callday-Webseite und die Callday-iOS-App.",
};

export default function PrivacyPage() {
  return (
    <article className="legal-article" lang="de">
      <Content />
    </article>
  );
}
