import type { Metadata } from "next";
import Content from "./content.mdx";

/**
 * /zoom — Zoom-Integration Setup-Guide (EN).
 *
 * Pflicht-Dokument für den Zoom-Marketplace-App-Listing ("Documentation
 * URL"): eine Zoom-spezifische Anleitung auf eigener Domain, die das
 * Hinzufügen, Nutzen und Entfernen der App abdeckt.
 *
 * Lebt im (legal)-Route-Group, weil das Group-Layout genau das liefert,
 * was diese Seite braucht — abgespeckter Header, lesbare Text-Column,
 * Footer — und die MDX-Typografie (mdx-components.tsx) greift ohne
 * Extra-Styling. Kein LangToggle: das Dokument ist EN-only (Zoom-
 * Reviewer + App-UI sind Englisch).
 *
 * page.tsx + content.mdx-Split analog zu privacy/terms — Next 16 + React
 * 19 inferieren reine MDX-Pages als Client, was den Metadata-Export
 * bricht.
 */

const CANONICAL = "https://callday.io/zoom";

export const metadata: Metadata = {
  title: "Callday + Zoom · Setup Guide",
  description:
    "How to connect, use, and remove the Zoom integration in Callday.",
  alternates: { canonical: CANONICAL },
};

export default function ZoomDocsPage() {
  return (
    <article className="legal-article" lang="en">
      <Content />
    </article>
  );
}
