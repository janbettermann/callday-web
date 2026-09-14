/**
 * Callday Lists — zentrale Konstanten des Lead-Generators.
 *
 * Die Groessen-Konstanten des Credit-Modells (SIGNUP_CREDITS,
 * DEFAULT_LIST_SIZE, MAX_LIST_SIZE) leben in lib/lists/credits.ts —
 * hier bleiben die Outscraper-Stellschrauben.
 */

import { APP_STORE_URL } from "@/lib/app-download";

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
 * ("Examples:"-Zeile). Bewusst nur drei + kurze Namen (Jan 2026-08-05):
 * auf Mobile eine Zeile. Verschiedene Sektoren (Gesundheit / Handwerk /
 * Recht) zeigen Breite, engen nicht auf eine Nische ein. Im
 * GMB-Singular-Stil, damit sie exakt Eintraege der Autocomplete-Liste
 * (lib/lists/gmb-categories.ts) treffen und das Haekchen kriegen
 * (garantiert per gmb-categories.test.ts). Freitext bleibt moeglich;
 * die Chips senken nur die Muell-Query-Quote.
 */
export const INDUSTRY_SUGGESTIONS = ["Dentist", "Plumber", "Law firm"];

/**
 * Ziel des "Open in Callday"-CTAs im Generator. Waehrend der Beta zeigte
 * das auf /account (TestFlight-2-Step-Card); seit dem App-Store-Launch
 * (2026-09-13) direkt auf die Store-Seite — die hat fuer installierte
 * Apps den "Oeffnen"-Button, fuer alle anderen den Download. Quelle der
 * URL ist lib/app-download.ts, hier nur die Weiterreichung.
 */
export const APP_DOWNLOAD_PATH = APP_STORE_URL;
