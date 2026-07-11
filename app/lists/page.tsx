import type { Metadata } from "next";
import { ListsClient } from "./ListsClient";

/**
 * callday.io/lists — Lead-Generator + Akquise-Funnel (Spec:
 * specs/lists-generator.md). Server-Wrapper nur fuer Metadata; die
 * Seite selbst ist auth-aware und lebt komplett im Client
 * (Session-Check + Job-Polling).
 */

export const metadata: Metadata = {
  title: "Callday Lists — your cold-calling list in 2 minutes",
  description:
    "Pick an industry and a city — we build a call-ready lead list. Every lead has a phone number. Your first list is free.",
};

export default function ListsPage() {
  return <ListsClient />;
}
