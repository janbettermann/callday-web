/**
 * Callday Lists — zentrale Konstanten des Lead-Generators.
 *
 * Free-Groesse und Overfetch sind bewusste Stellschrauben (siehe
 * specs/lists-generator.md §5/§11): 250 gelieferte anrufbare Leads ist
 * der Free-Hook; angefragt wird mehr, weil der Callable-Filter
 * (Telefonnummer + operational + Dedupe) einen Teil der rohen
 * Google-Maps-Ergebnisse verwirft.
 */

export const FREE_LIST_SIZE = 250;

/** Outscraper-Limit pro Query (Hard-Cap der API: 500). */
export const OUTSCRAPER_FETCH_LIMIT = 400;

/**
 * Maximale Scan-Tiefe bei aktivem Server-Filter: Das limit zaehlt
 * GESCANNTE Plaetze, nicht gefilterte Treffer (live gemessen
 * 2026-07-12: Baseline 10 Records/1 ohne Website vs. Filter-Lauf
 * 1 Record bei limit 10). Zurueck kommen nur Treffer — bei
 * Filter-Laeufen lohnt darum das API-Maximum.
 */
export const OUTSCRAPER_MAX_SCAN_LIMIT = 500;

/**
 * Kuratierte Branchen-Vorschlaege fuer die Chips unter dem Industry-Feld.
 * Scharf auf Cold-Calling-taugliche B2B-Branchen (Spec §11) — Freitext
 * bleibt moeglich, die Chips senken nur die Muell-Query-Quote.
 * Im GMB-Singular-Stil, damit sie exakt Eintraege der Autocomplete-
 * Liste (lib/lists/gmb-categories.ts) treffen und das Haekchen kriegen.
 */
export const INDUSTRY_SUGGESTIONS = [
  "Dentist",
  "Roofing contractor",
  "Real estate agency",
  "Marketing agency",
  "Law firm",
  "Gym",
  "Electrician",
  "Car dealer",
];

/**
 * Ziel des "Get the Callday app"-CTAs. Waehrend der Beta zeigt /account
 * die TestFlight-2-Step-Card; beim Public-Launch auf den App-Store-Link
 * umstellen (eine Stelle).
 */
export const APP_DOWNLOAD_PATH = "/account";
