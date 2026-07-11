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
 * Kuratierte Branchen-Vorschlaege fuer die Chips unter dem Industry-Feld.
 * Scharf auf Cold-Calling-taugliche B2B-Branchen (Spec §11) — Freitext
 * bleibt moeglich, die Chips senken nur die Muell-Query-Quote.
 */
export const INDUSTRY_SUGGESTIONS = [
  "Dentists",
  "Roofers",
  "Real estate agents",
  "Marketing agencies",
  "Law firms",
  "Gyms",
  "Electricians",
  "Car dealers",
];

/**
 * Ziel des "Get the Callday app"-CTAs. Waehrend der Beta zeigt /account
 * die TestFlight-2-Step-Card; beim Public-Launch auf den App-Store-Link
 * umstellen (eine Stelle).
 */
export const APP_DOWNLOAD_PATH = "/account";
