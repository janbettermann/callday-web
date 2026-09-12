/**
 * PLZ-Tiling des Listen-Generators — die PUREN Teile (Spec §14b.1):
 * Tile-Schluessel, Reihenfolge der PLZ-Tiles einer Stadt, Erschoepfungs-
 * Semantik der Coverage und die Wellen-Planung. Kein I/O — Datenzugriff
 * lebt in geo-data.ts (Postal-Daten, Places) und coverage.ts (Ledger).
 *
 * Warum Tiles: eine Google-Maps-Suche deckelt bei ~120 Listings und
 * streut bei Stadt-Queries Fremdstadt-Treffer ein (§6b: Berlin in einer
 * Koeln-Suche). PLZ-Queries ("Dentist, 50667, Köln") tilen sauber (75 %
 * in der Ziel-PLZ, Nachbarn ueberlappen kaum) und sind dichte-adaptiv.
 * Fuer den User aendert sich am Formular nichts — Stadt-Chip bleibt
 * Stadt-Chip, das Tiling laeuft im Hintergrund.
 */

import { OUTSCRAPER_FETCH_LIMIT, OUTSCRAPER_MAX_SCAN_LIMIT } from "./config";
import type { QueryPlanEntry } from "./fanout";
import { interleave } from "./interleave";
import { normalizePlaceName } from "./normalize";
import {
  matchesWebsiteFilter,
  type CallableLead,
  type WebsiteFilterMode,
} from "./pipeline";

/**
 * Erwartete Leads pro PLZ-Tile — dimensioniert die Welle
 * (ceil(max_size / EXPECTED)). Kalibriert 2026-09-12 an den ersten
 * Live-Laeufen: sieben Koeln/Huerth-Tiles lieferten 13–50 Plaetze,
 * im Schnitt 29; nach Callable-Filter + Bestands-Dedupe bleibt weniger.
 * Mit dem Startwert 12 holte eine 250er-Liste ~600 Records fuer 250
 * Leads (vorher 350) — 20 bringt das Verhaeltnis auf ~1,5 zurueck, der
 * Rest landet ohnehin im Spillover. Land-PLZ liefern weniger; dort
 * faengt der Folge-Lauf nach.
 */
export const EXPECTED_LEADS_PER_TILE = 20;
export const MIN_WAVE_TILES = 3;
export const MAX_WAVE_TILES = 25;

/**
 * Limit pro Tile beim ersten Besuch. Bezahlt wird nur Geliefertes — ein
 * hohes Limit kostet bei kleinen PLZ nichts und macht ein Tile fast
 * immer erschoepft ("abgehakt" = "fertig", §6b Punkt 4).
 */
export const TILE_LIMIT_FRESH = 50;
/** Limit fuer den zweiten Besuch eines "moeglicherweise nicht erschoepften" Tiles. */
export const TILE_LIMIT_RETRY = 200;
/**
 * Unschaerfe-Puffer der Erschoepfung: `dropDuplicates` schlaegt Treffer
 * an Gebietsgrenzen dem Nachbar-Tile zu — ein dichtes Tile kam live mit
 * 48 von 50 zurueck, obwohl es sicher mehr hat. Alles innerhalb des
 * Puffers unter dem Limit gilt deshalb noch als "moeglicherweise mehr".
 */
export const EXHAUSTION_SLACK = 5;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Viewport {
  low: LatLng;
  high: LatLng;
}

/** Row-Shape aus geo_postal_codes, soweit das Tiling sie braucht. */
export interface PostalRowLike {
  postal_code: string;
  place_name: string;
  lat: number;
  lng: number;
  search_names?: string[];
}

/** Ein Tile-Kandidat einer Stadt (vor Coverage-Abgleich). */
export interface TileCandidate {
  tile_id: string;
  query: string;
  /** Needle der City-first-Sortierung (PLZ-Ort bzw. Stadt). */
  city: string;
}

/** Alle Kandidaten eines Location-Chips (Fairness-Gruppe). */
export interface ChipCandidates {
  location: string;
  tiles: TileCandidate[];
}

/**
 * Persistierter Wellen-Plan (lead_gen_jobs.params.tiles) — erweitert den
 * alten Query-Plan um den Tile-Schluessel, damit orderForDelivery
 * unveraendert funktioniert und die Coverage beim Empfang jede Zeile
 * ueber ihre query-Spalte einem Tile zuordnen kann.
 */
export interface TilePlanEntry extends QueryPlanEntry {
  tile_id: string;
}

/** Coverage-Row, soweit die Klassifikation sie braucht. */
export interface CoverageRowLike {
  tile_id: string;
  website_filter: WebsiteFilterMode;
  result_count: number;
  limit_used: number;
}

export type TileState = "fresh" | "retry" | "closed";

export interface WavePlan {
  tiles: TilePlanEntry[];
  /** Outscraper-`limit` fuer die ganze Welle (EIN Request, EIN Limit). */
  limit: number;
  /** Alle Kandidaten-Tiles der Chips (fuer "12 of 90 areas covered"). */
  total: number;
  /** Davon vor dieser Welle bereits erschoepft. */
  covered: number;
  /** Noch offene Tiles (fresh + retry) — 0 = alles abgehakt. */
  open: number;
}

/** 'DE-50667' — die PLZ ist der natuerliche Schluessel. */
export function postalTileId(country: string, postalCode: string): string {
  return `${country}-${postalCode}`;
}

/**
 * Fallback ohne Postal-Daten: die heutige Stadt-Query als ein Tile —
 * 'CITY-DE-koln'. Mit Land, damit "Paris" in FR und US-TX nicht
 * kollidieren (Coverage haengt am Tile-Schluessel).
 */
export function cityTileId(country: string, cityName: string): string {
  return `CITY-${country}-${normalizePlaceName(cityName).replace(/\s+/g, "-")}`;
}

export function isCityTile(tileId: string): boolean {
  return tileId.startsWith("CITY-");
}

/**
 * Coverage-Schluessel der Branche: englische Kanonik bzw. woertlicher
 * Freitext, lowercase/trim — "Zahnarzt" (aufgeloest zu "Dentist") und
 * "Dentist" treffen dieselbe Coverage.
 */
export function categoryCanon(industry: string): string {
  return industry.trim().toLowerCase().replace(/\s+/g, " ");
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function centroidOf(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  const n = Math.max(1, points.length);
  return { lat: sum.lat / n, lng: sum.lng / n };
}

function rowMatchesName(row: PostalRowLike, key: string): boolean {
  if (!key) return false;
  if (row.search_names?.includes(key)) return true;
  return normalizePlaceName(row.place_name) === key;
}

/**
 * Reihenfolge der PLZ-Tiles einer Stadt: Tiles, deren Ort dem Chip-Namen
 * entspricht, ZUERST (die Viewport-Box einer Grossstadt schneidet auch
 * Nachbargemeinden an — Huerth liegt in der Koeln-Box; wer "Köln" sagt,
 * bekommt erst Koeln, die Nachbarn erst wenn Koeln abgegrast ist), dann
 * nach Distanz zum Zentrum (Zentrum zuerst = dichter), Rest-Tie ueber
 * die PLZ selbst — deterministisch. Ohne Namens-Treffer (Exonym
 * "Cologne" als Freitext) degradiert das sauber auf reine Distanz.
 */
export function orderPostalRows(
  rows: PostalRowLike[],
  center: LatLng,
  preferredName: string | null,
): PostalRowLike[] {
  const key = preferredName ? normalizePlaceName(preferredName) : "";
  return rows
    .map((row) => ({
      row,
      match: rowMatchesName(row, key) ? 0 : 1,
      distance: haversineKm(center, row),
    }))
    .sort(
      (a, b) =>
        a.match - b.match ||
        a.distance - b.distance ||
        a.row.postal_code.localeCompare(b.row.postal_code),
    )
    .map((entry) => entry.row);
}

/**
 * Erschoepfungs-Semantik (Spec §14b.1 Punkt 5) pro Tile und Filter.
 * Zaehlen Rows mit dem angefragten Filter ODER 'any' (ein "alle
 * Betriebe"-Lauf deckt jeden Filter ab; ein Filter-Lauf deckt nur sich
 * selbst — Begruendung in Migration 0056).
 * - result_count < limit_used − EXHAUSTION_SLACK ⇒ erschoepft (closed)
 * - result_count im Puffer oder = limit_used ⇒ "moeglicherweise mehr"
 *   (retry mit hoeherem Limit); ein Tile, das schon mit dem Retry-Limit
 *   lief, gilt als erschoepft (Google deckelt eine Einzelsuche weit
 *   darunter).
 * - keine Row ⇒ fresh
 */
export function classifyTile(
  rows: CoverageRowLike[],
  filter: WebsiteFilterMode,
): TileState {
  const relevant = rows.filter(
    (row) => row.website_filter === filter || row.website_filter === "any",
  );
  if (
    relevant.some(
      (row) =>
        row.result_count < row.limit_used - EXHAUSTION_SLACK ||
        row.limit_used >= TILE_LIMIT_RETRY,
    )
  ) {
    return "closed";
  }
  return relevant.length > 0 ? "retry" : "fresh";
}

/**
 * Outscraper-Limit der Welle. Ein Request hat EIN Limit, deshalb ist eine
 * Welle entweder komplett "fresh" (50) oder komplett "retry" (200) —
 * nie gemischt. Mit Website-Filter zaehlt das Limit GESCANNTE Plaetze
 * und Scans kosten nichts (§6b): immer das API-Maximum, damit jedes
 * Filter-Tile sicher erschoepft ist. CITY-Fallback-Tiles (keine Postal-
 * Daten, eine Query = ganze Stadt) brauchen das alte Stadt-Budget
 * (×1,4 der Wunschgroesse, verteilt) — die Welle nimmt das Maximum.
 */
function waveLimit(
  tiles: TilePlanEntry[],
  mode: "fresh" | "retry",
  filter: WebsiteFilterMode,
  needed: number,
): number {
  if (filter !== "any") return OUTSCRAPER_MAX_SCAN_LIMIT;
  if (mode === "retry") return TILE_LIMIT_RETRY;
  const cityTiles = tiles.filter((t) => isCityTile(t.tile_id)).length;
  if (cityTiles === 0) return TILE_LIMIT_FRESH;
  const cityLimit = Math.min(
    OUTSCRAPER_FETCH_LIMIT,
    Math.max(15, Math.ceil((needed * 1.4) / cityTiles)),
  );
  return Math.max(TILE_LIMIT_FRESH, cityLimit);
}

/**
 * Spillover-Rows, die DIESE Suche liefern darf (Spec §14b.1 Punkt 6,
 * praezisiert): nur Tiles der aktuellen Chips — wer "Hürth" sagt,
 * bekommt keine liegengebliebenen Koeln-Leads, obwohl beides "dentist"
 * ist —, nur Rows, die den Website-Filter erfuellen, hoechstens `max`.
 * Reihenfolge der Eingabe (aelteste zuerst) bleibt. Die Auswahl wird wie
 * die Welle bei Job-Erstellung fixiert (params.spillover_ids).
 */
export function selectSpillover<
  T extends { tile_id: string; lead_data: Pick<CallableLead, "website"> },
>(
  rows: T[],
  candidateTileIds: Set<string>,
  filter: WebsiteFilterMode,
  max: number,
): T[] {
  const picked: T[] = [];
  for (const row of rows) {
    if (picked.length >= max) break;
    if (!candidateTileIds.has(row.tile_id)) continue;
    if (!matchesWebsiteFilter(row.lead_data, filter)) continue;
    picked.push(row);
  }
  return picked;
}

/**
 * Eine Welle pro Job (Spec §14b.1 Punkt 3): die ersten
 * clamp(ceil(needed / EXPECTED), 3, 25) offenen Tiles, Round-Robin ueber
 * die Chips gezogen (Fairness wie orderForDelivery). Fresh-Tiles vor
 * Retry-Tiles (siehe waveLimit). `needed` = max_size minus verfuegbarem
 * Spillover — deckt der Spillover die Liste, faehrt keine Welle.
 * Dasselbe Tile unter zwei Chips (Stadt + ihr State) zaehlt einmal.
 */
export function planWave(input: {
  chips: ChipCandidates[];
  coverage: CoverageRowLike[];
  filter: WebsiteFilterMode;
  needed: number;
}): WavePlan {
  const byTile = new Map<string, CoverageRowLike[]>();
  for (const row of input.coverage) {
    const rows = byTile.get(row.tile_id) ?? [];
    rows.push(row);
    byTile.set(row.tile_id, rows);
  }

  const seen = new Set<string>();
  const fresh: TilePlanEntry[][] = [];
  const retry: TilePlanEntry[][] = [];
  let total = 0;
  let covered = 0;
  for (const chip of input.chips) {
    const chipFresh: TilePlanEntry[] = [];
    const chipRetry: TilePlanEntry[] = [];
    for (const tile of chip.tiles) {
      if (seen.has(tile.tile_id)) continue;
      seen.add(tile.tile_id);
      total += 1;
      const state = classifyTile(byTile.get(tile.tile_id) ?? [], input.filter);
      const entry: TilePlanEntry = {
        tile_id: tile.tile_id,
        query: tile.query,
        city: tile.city,
        location: chip.location,
      };
      if (state === "closed") covered += 1;
      else if (state === "fresh") chipFresh.push(entry);
      else chipRetry.push(entry);
    }
    fresh.push(chipFresh);
    retry.push(chipRetry);
  }

  const open = total - covered;
  if (input.needed <= 0 || open === 0) {
    return { tiles: [], limit: 0, total, covered, open };
  }

  const size = Math.max(
    MIN_WAVE_TILES,
    Math.min(
      MAX_WAVE_TILES,
      Math.ceil(input.needed / EXPECTED_LEADS_PER_TILE),
    ),
  );
  const freshAll = interleave(fresh);
  const mode = freshAll.length > 0 ? "fresh" : "retry";
  const tiles = (mode === "fresh" ? freshAll : interleave(retry)).slice(
    0,
    size,
  );
  return {
    tiles,
    limit: waveLimit(tiles, mode, input.filter, input.needed),
    total,
    covered,
    open,
  };
}
