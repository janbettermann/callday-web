/**
 * Callday Lists — zentrale Konstanten des Lead-Generators.
 *
 * Die Groessen-Konstanten des Credit-Modells (SIGNUP_CREDITS,
 * DEFAULT_LIST_SIZE, MAX_LIST_SIZE) leben in lib/lists/credits.ts —
 * hier bleiben die Outscraper-Stellschrauben.
 */

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
 * Kuratierte Branchen-BEISPIELE fuer die Chips unter dem Industry-Feld
 * ("Examples:"-Zeile). Bewusst nur vier + kurze Namen (Jan-Wahl Set A,
 * 2026-08-05): auf Mobile max. 2 Zeilen statt 3. Je ein Sektor —
 * Gesundheit / Handwerk / Recht / Handel — zeigt Breite, engt nicht auf
 * eine Nische ein. Im GMB-Singular-Stil, damit sie exakt Eintraege der
 * Autocomplete-Liste (lib/lists/gmb-categories.ts) treffen und das
 * Haekchen kriegen (garantiert per gmb-categories.test.ts). Freitext
 * bleibt moeglich; die Chips senken nur die Muell-Query-Quote.
 */
export const INDUSTRY_SUGGESTIONS = [
  "Dentist",
  "Plumber",
  "Law firm",
  "Car dealer",
];

/**
 * Ziel des "Get the Callday app"-CTAs. Waehrend der Beta zeigt /account
 * die TestFlight-2-Step-Card; beim Public-Launch auf den App-Store-Link
 * umstellen (eine Stelle).
 */
export const APP_DOWNLOAD_PATH = "/account";
