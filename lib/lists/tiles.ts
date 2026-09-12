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
 * Erwartete Leads pro PLZ-Tile — bestimmt die Tile-Zahl einer Welle
 * (ceil(needed / EXPECTED)). Kalibriert 2026-09-12 an den ersten
 * Live-Laeufen: sieben Koeln/Huerth-Tiles lieferten 13–50 Plaetze,
 * im Schnitt 29; nach Callable-Filter + Bestands-Dedupe bleibt weniger.
 * Land-PLZ liefern weniger; dort faengt der Folge-Lauf nach.
 */
export const EXPECTED_LEADS_PER_TILE = 20;
/**
 * Dasselbe fuer Filter-Laeufe: der Website-Filter laesst nur einen
 * Bruchteil durch (live 3–10 Treffer pro Innenstadt-PLZ bei "ohne
 * Website"), Scans kosten nichts — also mehr Tiles pro Welle.
 */
export const EXPECTED_FILTERED_LEADS_PER_TILE = 5;
export const MAX_WAVE_TILES = 25;

/**
 * KAUFEN NACH BEDARF (Jan-Entscheidung 2026-09-13, ersetzt "50 pro Tile"):
 * Limit pro Tile = needed × WAVE_MARGIN / Tiles, geklammert auf
 * [TILE_LIMIT_MIN, TILE_LIMIT_MAX]. Die Marge deckt Callable-Filter und
 * Bestands-Dedupe (Erstnutzer verlieren 5–15 %).
 *
 * Hintergrund: Limit 50 kaufte bei dichten Tiles die vollen 50, egal ob
 * 10 oder 30 Leads gebraucht wurden — Spillover 125 % der Lieferung am
 * Testtag 2026-09-12. Die Wette dahinter ("der Nutzer kommt mit derselben
 * Suche wieder und holt den Vorrat ab") gilt fuer die meisten Nutzertypen
 * nicht: gleiche Stadt/andere Branche, gleiche Branche/andere Stadt,
 * Einmal-Nutzer. Preis des Bedarfs-Einkaufs: dichte Tiles erreichen ihr
 * Limit oefter, gelten als "moeglicherweise mehr" und werden erst bei
 * Bedarf nachgekauft (progressiver Retry, siehe waveLimit) — trifft nur
 * Nutzer, die dieselbe Branche im selben Gebiet vertiefen.
 */
export const WAVE_MARGIN = 1.4;
/** Boden: winzige Anfragen sollen nicht in Ein-Treffer-Queries zerfallen. */
export const TILE_LIMIT_MIN = 15;
/** Deckel pro Tile beim ersten Besuch. */
export const TILE_LIMIT_MAX = 50;
/**
 * Deckel fuer Nachkaeufe. Google liefert pro Suche ~120 Listings — ein
 * Tile, das mit 200 lief, ist damit sicher am Ende.
 */
export const TILE_LIMIT_RETRY_MAX = 200;

/**
 * Unschaerfe-Puffer der Erschoepfung: `dropDuplicates` schlaegt Treffer
 * an Gebietsgrenzen dem Nachbar-Tile zu — ein dichtes Tile kam live mit
 * 48 von 50 zurueck, obwohl es sicher mehr hat. Alles innerhalb des
 * Puffers unter dem Limit gilt deshalb noch als "moeglicherweise mehr".
 * Proportional zum Limit (10 %, min 2, max 20) — ein fixer Puffer von 5
 * waere bei Limit 15 ein Drittel.
 */
export function exhaustionSlack(limit: number): number {
  return Math.max(2, Math.min(20, Math.round(limit * 0.1)));
}

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
  /** Gesetzt bei PLZ-Tiles — die Kern-PLZ eines Jobs bilden das
   *  "Suchgebiet" fuer die Liefer-Sortierung (pipeline.sortByAreaMatch). */
  postal_code?: string;
  /** Kern = der Ort der PLZ ist die angefragte Stadt. Die Viewport-Box
   *  einer Grossstadt schneidet Nachbargemeinden an (Huerth, Frechen in
   *  der Koeln-Box) — die sind Rand: Welle erst nach dem Kern, Spillover
   *  erst wenn der Kern durch ist (spilloverEligibleTiles). */
  core: boolean;
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
  /** Alle Kandidaten-Tiles der Chips. */
  total: number;
  /** Davon vor dieser Welle erschoepft (closed). */
  covered: number;
  /** Davon vor dieser Welle schon einmal besucht (closed + retry) —
   *  Basis der Copy "12 of 60 areas searched so far". */
  visited: number;
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
 * Rows, die fuer den angefragten Filter zaehlen: derselbe Filter ODER
 * 'any' (ein "alle Betriebe"-Lauf deckt jeden Filter ab; ein Filter-Lauf
 * deckt nur sich selbst — Begruendung in Migration 0056).
 */
function relevantRows(
  rows: CoverageRowLike[],
  filter: WebsiteFilterMode,
): CoverageRowLike[] {
  return rows.filter(
    (row) => row.website_filter === filter || row.website_filter === "any",
  );
}

/**
 * Erschoepfungs-Semantik (Spec §14b.1 Punkt 5) pro Tile und Filter:
 * - result_count < limit_used − Puffer ⇒ erschoepft (closed)
 * - result_count im Puffer oder = limit_used ⇒ "moeglicherweise mehr"
 *   (retry: naechste Schicht nachkaufen); ein Tile, das schon mit dem
 *   Retry-Deckel lief, gilt als erschoepft (Google deckelt eine
 *   Einzelsuche weit darunter).
 * - keine Row ⇒ fresh
 */
export function classifyTile(
  rows: CoverageRowLike[],
  filter: WebsiteFilterMode,
): TileState {
  const relevant = relevantRows(rows, filter);
  if (
    relevant.some(
      (row) =>
        row.result_count < row.limit_used - exhaustionSlack(row.limit_used) ||
        row.limit_used >= TILE_LIMIT_RETRY_MAX,
    )
  ) {
    return "closed";
  }
  return relevant.length > 0 ? "retry" : "fresh";
}

/** Tiefstes bisheriges Limit eines Tiles — Basis der naechsten Schicht. */
function deepestLimit(
  rows: CoverageRowLike[],
  filter: WebsiteFilterMode,
): number {
  return Math.max(0, ...relevantRows(rows, filter).map((row) => row.limit_used));
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
 * Tiles, aus denen DIESE Suche Spillover ziehen darf: die Kern-Tiles
 * immer; Rand-Tiles (Nachbargemeinden in der Box) erst, wenn kein
 * Kern-Tile mehr unbesucht ist — sonst landen 13 Huerther Baeckereien
 * aus einer frueheren Huerth-Suche ganz oben in der Koeln-Liste (live
 * 2026-09-12). Gleiche Reihenfolge wie die Welle: erst Kern, dann Rand.
 */
export function spilloverEligibleTiles(
  chips: ChipCandidates[],
  coverage: CoverageRowLike[],
  filter: WebsiteFilterMode,
): Set<string> {
  const byTile = new Map<string, CoverageRowLike[]>();
  for (const row of coverage) {
    const rows = byTile.get(row.tile_id) ?? [];
    rows.push(row);
    byTile.set(row.tile_id, rows);
  }
  const all = chips.flatMap((chip) => chip.tiles);
  const coreOpen = all.some(
    (tile) =>
      tile.core && classifyTile(byTile.get(tile.tile_id) ?? [], filter) === "fresh",
  );
  return new Set(
    all.filter((tile) => tile.core || !coreOpen).map((tile) => tile.tile_id),
  );
}

/** Tile-Zahl einer Welle aus dem Bedarf — keine Untergrenze mehr. */
export function tilesForNeed(
  needed: number,
  filter: WebsiteFilterMode,
): number {
  const expected =
    filter === "any"
      ? EXPECTED_LEADS_PER_TILE
      : EXPECTED_FILTERED_LEADS_PER_TILE;
  return Math.max(1, Math.min(MAX_WAVE_TILES, Math.ceil(needed / expected)));
}

/** Bedarfsanteil pro Tile: needed × Marge / Tiles, geklammert. */
function shareLimit(needed: number, tileCount: number): number {
  return Math.max(
    TILE_LIMIT_MIN,
    Math.min(
      TILE_LIMIT_MAX,
      Math.ceil((needed * WAVE_MARGIN) / Math.max(1, tileCount)),
    ),
  );
}

/**
 * Outscraper-Limit der Welle. Ein Request hat EIN Limit, deshalb ist
 * eine Welle entweder komplett "fresh" oder komplett "retry" — nie
 * gemischt.
 * - fresh: der Bedarfsanteil pro Tile (shareLimit).
 * - retry (progressiv): tiefstes bisheriges Limit der Retry-Tiles plus
 *   Bedarfsanteil, gedeckelt — die naechste Schicht, nicht "alles".
 *   Bekannte Betriebe kommen dabei nochmal mit (Outscraper kennt kein
 *   Ausschliessen, skipPlaces ist wegen Ranking-Jitter unbrauchbar) und
 *   werden vom Bestands-Dedupe geworfen; das ist der Preis des
 *   Bedarfs-Einkaufs, er faellt nur bei Vertiefern an.
 * - Website-Filter: das Limit zaehlt GESCANNTE Plaetze und Scans kosten
 *   nichts (§6b) — immer das API-Maximum, jedes Filter-Tile ist danach
 *   sicher erschoepft.
 * - CITY-Fallback-Tiles (keine Postal-Daten, eine Query = ganze Stadt)
 *   brauchen das alte Stadt-Budget (×1,4 der Wunschgroesse, Cap 400);
 *   die Welle nimmt das Maximum.
 */
function waveLimit(
  tiles: TilePlanEntry[],
  mode: "fresh" | "retry",
  filter: WebsiteFilterMode,
  needed: number,
  retryBase: number,
): number {
  if (filter !== "any") return OUTSCRAPER_MAX_SCAN_LIMIT;
  const cityTiles = tiles.filter((t) => isCityTile(t.tile_id)).length;
  const share = shareLimit(needed, tiles.length);
  const cityBudget =
    cityTiles > 0
      ? Math.min(
          OUTSCRAPER_FETCH_LIMIT,
          Math.max(TILE_LIMIT_MIN, Math.ceil((needed * WAVE_MARGIN) / cityTiles)),
        )
      : 0;
  const layer = Math.max(share, cityBudget);
  if (mode === "fresh") return layer;
  const cap = cityTiles > 0 ? OUTSCRAPER_FETCH_LIMIT : TILE_LIMIT_RETRY_MAX;
  return Math.min(cap, retryBase + layer);
}

/**
 * Eine Welle pro Job (Spec §14b.1 Punkt 3): tilesForNeed(needed) offene
 * Tiles, Round-Robin ueber die Chips gezogen (Fairness wie
 * orderForDelivery), Limit nach Bedarf (waveLimit). Fresh-Tiles vor
 * Retry-Tiles: solange irgendein Tile im Suchgebiet unbesucht ist,
 * besteht die Welle nur aus frischen — erst in die Breite, dann in die
 * Tiefe. `needed` = max_size minus verfuegbarem Spillover — deckt der
 * Spillover die Liste, faehrt keine Welle. Dasselbe Tile unter zwei
 * Chips (Stadt + ihr State) zaehlt einmal.
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
  const retryBaseByTile = new Map<string, number>();
  let total = 0;
  let covered = 0;
  let freshCount = 0;
  for (const chip of input.chips) {
    const chipFresh: TilePlanEntry[] = [];
    const chipRetry: TilePlanEntry[] = [];
    for (const tile of chip.tiles) {
      if (seen.has(tile.tile_id)) continue;
      seen.add(tile.tile_id);
      total += 1;
      const rows = byTile.get(tile.tile_id) ?? [];
      const state = classifyTile(rows, input.filter);
      const entry: TilePlanEntry = {
        tile_id: tile.tile_id,
        query: tile.query,
        city: tile.city,
        location: chip.location,
      };
      if (state === "closed") {
        covered += 1;
      } else if (state === "fresh") {
        freshCount += 1;
        chipFresh.push(entry);
      } else {
        retryBaseByTile.set(tile.tile_id, deepestLimit(rows, input.filter));
        chipRetry.push(entry);
      }
    }
    fresh.push(chipFresh);
    retry.push(chipRetry);
  }

  const open = total - covered;
  const visited = total - freshCount;
  if (input.needed <= 0 || open === 0) {
    return { tiles: [], limit: 0, total, covered, visited, open };
  }

  const size = tilesForNeed(input.needed, input.filter);
  const freshAll = interleave(fresh);
  const mode = freshAll.length > 0 ? "fresh" : "retry";
  const tiles = (mode === "fresh" ? freshAll : interleave(retry)).slice(
    0,
    size,
  );
  const retryBase =
    mode === "retry"
      ? Math.max(0, ...tiles.map((t) => retryBaseByTile.get(t.tile_id) ?? 0))
      : 0;
  return {
    tiles,
    limit: waveLimit(tiles, mode, input.filter, input.needed, retryBase),
    total,
    covered,
    visited,
    open,
  };
}
