/**
 * Location-Fan-out des Generators (Generator-v3 §14b Punkt 5):
 * Aus den Location-Chips (Staedte + Regionen) wird ein deterministischer
 * Query-Plan — eine Outscraper-Query pro Stadt, Regionen werden in ihre
 * Top-Staedte aufgefaechert (NIE als eine State-Query, §6b). Der Plan
 * wird bei Job-Erstellung in params.query_plan persistiert, damit die
 * Verarbeitung (Interleave, City-Zuordnung) nichts re-deriven muss.
 */

import {
  OUTSCRAPER_FETCH_LIMIT,
  OUTSCRAPER_MAX_SCAN_LIMIT,
} from "./config";
import { getRegion } from "./geo-regions";

/** Max. Location-Chips pro Liste (Jan-Entscheidung 2026-08-05). */
export const MAX_LOCATIONS = 5;

/** Ein Location-Chip, wie ihn der Client schickt. */
export interface LocationInput {
  /** Anzeigename; bei region_id gewinnt der Asset-Name. */
  name: string;
  /** Gesetzt bei State-Chips — muss in GEO_REGIONS existieren. */
  region_id?: string;
}

/** Ein Eintrag des persistierten Query-Plans (params.query_plan). */
export interface QueryPlanEntry {
  /** Der exakte Outscraper-Query-String. */
  query: string;
  /** Stadt der Query — Needle fuer die City-first-Sortierung. */
  city: string;
  /** Label des Chips, zu dem die Query gehoert (Fairness-Gruppe). */
  location: string;
}

/**
 * Staedte pro Region abhaengig von der Chip-Zahl: ein einzelner
 * State-Chip darf tief gehen, viele Chips teilen sich das Budget —
 * haelt den Plan bei <= ~25 Queries (Kosten + Request-Groesse).
 */
function citiesPerRegion(regionCount: number): number {
  if (regionCount <= 1) return 12;
  if (regionCount <= 3) return 8;
  return 5;
}

/**
 * Chips → Query-Plan. Stadt-Chips bleiben im heutigen Query-Format
 * (`industry, city`); Region-Staedte bekommen den State-Namen dazu
 * (`industry, city, state`) — Praezision bei mehrdeutigen Namen
 * (Springfield!), Format analog zu Outscrapers eigenen Micro-Queries.
 * Unbekannte region_ids werden ignoriert (Aufrufer validiert vorher).
 */
export function buildQueryPlan(
  industry: string,
  locations: LocationInput[],
  country: string,
): QueryPlanEntry[] {
  const regionCount = locations.filter((l) => l.region_id).length;
  const cityBudget = citiesPerRegion(regionCount);
  const plan: QueryPlanEntry[] = [];

  for (const location of locations.slice(0, MAX_LOCATIONS)) {
    if (location.region_id) {
      const region = getRegion(location.region_id);
      if (!region || region.country !== country) continue;
      for (const city of region.cities.slice(0, cityBudget)) {
        plan.push({
          query: `${industry}, ${city}, ${region.name}`,
          city,
          location: region.name,
        });
      }
    } else {
      plan.push({
        query: `${industry}, ${location.name}`,
        city: location.name,
        location: location.name,
      });
    }
  }
  return plan;
}

/**
 * Scan-Limit PRO Query. Mit den immer aktiven Server-Filtern zaehlt
 * das Limit gescannte Plaetze; bezahlt wird nur Geliefertes (§6b).
 * - Ohne Website-Filter ist geliefert ≈ gescannt → Budget eng an der
 *   Wunschgroesse (+40 % fuer Dedupe/Verschnitt), Floor 15 pro Stadt.
 * - Mit Website-Filter (~5 % Trefferquote) sind Scans quasi gratis →
 *   grosszuegig scannen (maxSize × 20 verteilt), damit die Liste voll
 *   wird; API-Hard-Cap 500 pro Query.
 */
export function computePerQueryLimit(
  maxSize: number,
  queryCount: number,
  websiteFiltered: boolean,
): number {
  const count = Math.max(1, queryCount);
  if (websiteFiltered) {
    return Math.min(
      OUTSCRAPER_MAX_SCAN_LIMIT,
      Math.max(60, Math.ceil((maxSize * 20) / count)),
    );
  }
  return Math.min(
    OUTSCRAPER_FETCH_LIMIT,
    Math.max(15, Math.ceil((maxSize * 1.4) / count)),
  );
}
