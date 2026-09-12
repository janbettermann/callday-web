/**
 * Enricher erst bei Lieferung (Spec §14b.1 Schritt 3, Jan 2026-09-13) —
 * die PUREN Teile: welche Betriebe eine E-Mail-Suche brauchen und wie
 * die Antwort des Emails-and-Contacts-Endpunkts in die Leads kommt.
 *
 * Warum: der Enricher lief bisher in jeder Maps-Welle fuer JEDEN
 * gefetchten Betrieb mit — auch fuer die, die der Bestands-Dedupe
 * danach wegwarf oder die im Spillover liegen blieben. Das war rund die
 * Haelfte der Outscraper-Kosten. Jetzt wird nur angereichert, was
 * wirklich in der Liste landet; Spillover-Leads bekommen ihre E-Mail
 * beim Ausliefern. Die Auswahl-Regeln (emails.ts) bleiben identisch —
 * gleiche Quelle, gleiche Strenge, gleiche Prefill-Quote.
 */

import { choosePrefillEmail, collectEmailCandidates } from "./emails";
import type { OutscraperEmailResult } from "./outscraper";
import type { CallableLead } from "./pipeline";

/**
 * Website-URLs, die eine E-Mail-Suche brauchen: Leads mit Website und
 * ohne E-Mail (Spillover aus der Zeit vor Schritt 3 hat sie schon),
 * dedupliziert — Ketten teilen sich eine Domain. Reihenfolge stabil.
 */
export function enrichmentTargets(leads: CallableLead[]): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const lead of leads) {
    if (!lead.website || lead.email) continue;
    const key = lead.website.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(key);
  }
  return targets;
}

/**
 * Antwort → Leads: pro Website die Kandidaten einsammeln (Quelle
 * normalisiert wie bisher) und hoechstens EINE Adresse waehlen
 * (Domain-Match > konservativer Freemail-Match > leer). Bestehende
 * E-Mails bleiben, Leads ohne Website bleiben unberuehrt. Gibt die
 * Leads in derselben Reihenfolge zurueck plus die Zahl der neu
 * gefuellten Felder (Admin-Kennzahl).
 */
export function applyEmailEnrichment(
  leads: CallableLead[],
  results: OutscraperEmailResult[],
): { leads: CallableLead[]; filled: number } {
  const byQuery = new Map<string, OutscraperEmailResult>();
  for (const result of results) {
    if (result.query) byQuery.set(result.query.trim(), result);
  }

  let filled = 0;
  const enriched = leads.map((lead) => {
    if (!lead.website || lead.email) return lead;
    const result = byQuery.get(lead.website.trim());
    if (!result?.emails?.length) return lead;
    const candidates = collectEmailCandidates(
      result.emails.map((entry) => ({ email: entry.value, source: entry.source })),
    );
    const email = choosePrefillEmail(candidates, {
      website: lead.website,
      companyName: lead.company_name,
    });
    if (!email) return lead;
    filled += 1;
    return { ...lead, email };
  });
  return { leads: enriched, filled };
}
