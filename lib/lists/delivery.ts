/**
 * Zusammenfuehrung einer Lieferung — PUR, getestet (delivery.test.ts):
 * Spillover zuerst, dann die Welle, Cap auf max_size, Ueberschuss
 * zurueck; dazu die Tile-Bilanz fuer Coverage + Spillover. jobs.ts macht
 * drumherum nur noch I/O (Outscraper holen, Claim, Insert, Ledger).
 *
 * Reihenfolge-Garantien:
 * - Spillover-Leads kommen in Plan-Reihenfolge (aelteste zuerst) VOR
 *   allen Wellen-Leads (0 Outscraper-Kosten, bezahlt sind sie schon).
 * - Wellen-Leads laufen durch orderForDelivery (Round-Robin ueber Chips,
 *   city-first) — Alt-Jobs mit query_plan genauso wie Tile-Jobs.
 * - Dedupe-Kette: Bestand des Accounts → gelieferter Spillover → Welle.
 */

import type { SpilloverRow } from "./coverage";
import type { QueryPlanEntry } from "./fanout";
import type { OutscraperPlace } from "./outscraper";
import {
  countPlacesByQuery,
  filterByWebsite,
  filterKnownPhones,
  matchesWebsiteFilter,
  normalizePhoneKey,
  orderForDelivery,
  toCallableLeads,
  type CallableLead,
  type WebsiteFilterMode,
} from "./pipeline";
import type { TilePlanEntry } from "./tiles";

export interface DeliveryInput {
  /** Outscraper-Rohzeilen der Welle (leer bei Spillover-only). */
  places: OutscraperPlace[];
  /** Fixierte Spillover-Auswahl in Plan-Reihenfolge (params.spillover_ids). */
  spillover: SpilloverRow[];
  /** Telefon-Schluessel aller Leads, die der Account schon besitzt. */
  knownPhoneKeys: Set<string>;
  maxSize: number;
  websiteFilter: WebsiteFilterMode;
  /** Fallback-Branche fuer Leads ohne Kategorie (nutzer-sichtbar). */
  fallbackIndustry: string | null;
  /** Markt-Sprache fuer die Tages-Namen der Oeffnungszeiten. */
  marketLanguage: string;
  /** params.tiles bzw. params.query_plan (Alt-Jobs); undefined = Ein-Stadt-Sort. */
  plan: QueryPlanEntry[] | undefined;
  /** Anzeige-Stadt als Sort-Fallback ohne Plan. */
  city: string | null;
}

export interface DeliveryResult {
  /** Die Liste in Lieferreihenfolge (Spillover, dann Welle), <= maxSize. */
  leads: CallableLead[];
  /** Bezahlt, nicht geliefert — traegt source_query fuer die Tile-Zuordnung. */
  overflow: CallableLead[];
  /** Spillover-Rows, die weg koennen: geliefert ODER tot (Nummer im Bestand, Dublette). */
  consumedSpilloverIds: string[];
  spilloverDelivered: number;
}

/**
 * Spillover-Rows → Leads fuer diesen Lauf. Rows, die den Website-Filter
 * nicht erfuellen, bleiben fuer einen anderen Filter liegen; Rows, deren
 * Nummer der Account schon hat (oder Dubletten im Spillover), sind tot
 * und werden mit aufgeraeumt; alles ueber maxSize bleibt fuer den
 * naechsten Lauf.
 */
function takeSpillover(
  rows: SpilloverRow[],
  filter: WebsiteFilterMode,
  knownPhoneKeys: Set<string>,
  maxSize: number,
): { leads: CallableLead[]; consumedIds: string[] } {
  const leads: CallableLead[] = [];
  const consumedIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const lead = row.lead_data;
    if (!matchesWebsiteFilter(lead, filter)) continue;
    const key = normalizePhoneKey(lead.phone);
    if (!key || knownPhoneKeys.has(key) || seen.has(key)) {
      consumedIds.push(row.id);
      continue;
    }
    if (leads.length >= maxSize) break;
    seen.add(key);
    leads.push(lead);
    consumedIds.push(row.id);
  }
  return { leads, consumedIds };
}

export function assembleDelivery(input: DeliveryInput): DeliveryResult {
  const spillover = takeSpillover(
    input.spillover,
    input.websiteFilter,
    input.knownPhoneKeys,
    input.maxSize,
  );

  const callable = toCallableLeads(
    input.places,
    input.fallbackIndustry,
    input.marketLanguage,
  );
  const filtered = filterByWebsite(callable, input.websiteFilter);

  // Bestands-Dedupe: was der Account schon hat oder gerade aus dem
  // Spillover bekommt, kommt aus der Welle nicht nochmal rein.
  const known = new Set(input.knownPhoneKeys);
  for (const lead of spillover.leads) known.add(normalizePhoneKey(lead.phone));
  const fresh = filterKnownPhones(filtered, known);

  const ordered = orderForDelivery(fresh, input.plan, input.city);
  const remaining = Math.max(0, input.maxSize - spillover.leads.length);
  return {
    leads: [...spillover.leads, ...ordered.slice(0, remaining)],
    overflow: ordered.slice(remaining),
    consumedSpilloverIds: spillover.consumedIds,
    spilloverDelivered: spillover.leads.length,
  };
}

export interface TileOutcome {
  /** Eine Row pro Tile der Welle — 0 Treffer ist ein echter Befund. */
  coverage: Array<{
    tile_id: string;
    website_filter: WebsiteFilterMode;
    result_count: number;
    limit_used: number;
  }>;
  /** Ueberschuss, seinem Tile zugeordnet; source_query gestrippt. */
  spillover: Array<{ tile_id: string; lead_data: CallableLead }>;
}

/**
 * Tile-Bilanz beim Empfang (Spec §14b.1 Punkte 4–6): result_count =
 * gelieferte PLAETZE pro Query (nach place_id-Gruppierung — Enrichment-
 * Zeilen zaehlen nicht), Ueberschuss ueber die query-Spalte seinem Tile
 * zugeordnet. Ohne Tile-Zuordnung (defensiv, kommt nicht vor) lieber
 * verwerfen als unter falschem Schluessel ablegen.
 */
export function buildTileOutcome(input: {
  tiles: TilePlanEntry[];
  places: OutscraperPlace[];
  overflow: CallableLead[];
  limitUsed: number;
  websiteFilter: WebsiteFilterMode;
}): TileOutcome {
  const counts = countPlacesByQuery(input.places);
  const coverage = input.tiles.map((tile) => ({
    tile_id: tile.tile_id,
    website_filter: input.websiteFilter,
    result_count: counts.get(tile.query) ?? 0,
    limit_used: input.limitUsed,
  }));

  const tileByQuery = new Map(
    input.tiles.map((tile) => [tile.query, tile.tile_id]),
  );
  const spillover = input.overflow.flatMap(({ source_query, ...lead }) => {
    const tileId = source_query ? tileByQuery.get(source_query) : undefined;
    return tileId ? [{ tile_id: tileId, lead_data: lead }] : [];
  });

  return { coverage, spillover };
}
