import type { Metadata } from "next";
import Content from "./content.mdx";

/**
 * /terms — Wrapper-Page für content.mdx.
 *
 * Warum kein page.mdx direkt? Next 16 + React 19 inferieren MDX-Pages als
 * Client-Components, weil der Compiler-Output `useMDXComponents`
 * importiert und React den `use`-Prefix als Hook erkennt (Client-only).
 * Client-Components dürfen `metadata` nicht exportieren → Build-Error.
 *
 * Workaround: page.tsx als Server-Component-Shell, MDX als Child-Content.
 * Metadata lebt hier, der MDX-Inhalt bleibt unverändert.
 */

export const metadata: Metadata = {
  title: "Nutzungsbedingungen · Callday",
  description:
    "Nutzungsbedingungen für die Callday-iOS-App und die zugehörige Webseite.",
};

export default function TermsPage() {
  return (
    <article className="legal-article">
      <Content />
    </article>
  );
}
