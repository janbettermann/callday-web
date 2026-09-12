/**
 * Location-Fan-out des Generators (Generator-v3 §14b Punkt 5 + §14b.1):
 * Aus den Location-Chips (Staedte + Regionen) werden Stadt-Ziele —
 * Regionen werden in ihre Top-Staedte aufgefaechert (NIE als eine
 * State-Query, §6b). Jedes Stadt-Ziel wird anschliessend in PLZ-Tiles
 * aufgeloest (geo-data.ts resolveCityTiles) und die Welle in
 * params.tiles fixiert, damit die Verarbeitung nichts re-deriven muss.
 */

import { getRegion, type GeoRegion } from "./geo-regions";

/** Max. Location-Chips pro Liste (Jan-Entscheidung 2026-08-05). */
export const MAX_LOCATIONS = 5;

/** Ein Location-Chip, wie ihn der Client schickt. */
export interface LocationInput {
  /** Anzeigename; bei region_id gewinnt der Asset-Name. */
  name: string;
  /** Gesetzt bei State-Chips — muss in GEO_REGIONS existieren. */
  region_id?: string;
  /** Google-Places-ID des Stadt-Vorschlags — Schluessel fuer die
   *  Viewport-Aufloesung Stadt → PLZ-Tiles. Freitext-Chips haben keine. */
  place_id?: string;
}

/**
 * Ein Eintrag des Query-Plans: die Basis-Form, die orderForDelivery
 * versteht. Alt-Jobs (vor dem Tiling) tragen sie in params.query_plan,
 * Tile-Jobs die erweiterte TilePlanEntry-Form in params.tiles.
 */
export interface QueryPlanEntry {
  /** Der exakte Outscraper-Query-String. */
  query: string;
  /** Stadt der Query — Needle fuer die City-first-Sortierung. */
  city: string;
  /** Label des Chips, zu dem die Query gehoert (Fairness-Gruppe). */
  location: string;
}

/** Eine Stadt, die getilt werden soll — Ergebnis von expandLocations. */
export interface CityTarget {
  city: string;
  /** Chip-Label (Fairness-Gruppe): die Stadt selbst oder ihre Region. */
  location: string;
  /** Gesetzt, wenn die Stadt aus einem State-Chip stammt. */
  region: GeoRegion | null;
  place_id: string | null;
}

/**
 * Staedte pro Region abhaengig von der Chip-Zahl: ein einzelner
 * State-Chip darf tief gehen, viele Chips teilen sich das Budget.
 */
function citiesPerRegion(regionCount: number): number {
  if (regionCount <= 1) return 12;
  if (regionCount <= 3) return 8;
  return 5;
}

/**
 * Chips → Stadt-Ziele. Unbekannte region_ids werden ignoriert (Aufrufer
 * validiert vorher); Regionen des falschen Landes ebenso.
 */
export function expandLocations(
  locations: LocationInput[],
  country: string,
): CityTarget[] {
  const regionCount = locations.filter((l) => l.region_id).length;
  const cityBudget = citiesPerRegion(regionCount);
  const targets: CityTarget[] = [];

  for (const location of locations.slice(0, MAX_LOCATIONS)) {
    if (location.region_id) {
      const region = getRegion(location.region_id);
      if (!region || region.country !== country) continue;
      for (const city of region.cities.slice(0, cityBudget)) {
        targets.push({ city, location: region.name, region, place_id: null });
      }
    } else {
      targets.push({
        city: location.name,
        location: location.name,
        region: null,
        place_id: location.place_id ?? null,
      });
    }
  }
  return targets;
}

/**
 * Stadt-Query ohne Tiling (CITY-Fallback, wenn keine Postal-Daten
 * greifen): das bisherige Format — `industry, city`, Region-Staedte mit
 * State-Namen (`industry, city, state` — Springfield-Praezision, Format
 * wie Outscrapers eigene Micro-Queries).
 */
export function cityQuery(industry: string, target: CityTarget): string {
  return target.region
    ? `${industry}, ${target.city}, ${target.region.name}`
    : `${industry}, ${target.city}`;
}
