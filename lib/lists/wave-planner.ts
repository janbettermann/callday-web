/**
 * Planung einer Welle — I/O + Orchestrierung, geteilt zwischen der
 * Generate-Route (Welle 1) und der Verarbeitung (Nachschlag-Wellen,
 * Spec §14b.1 Schritt 2): Chips → Staedte → Tile-Kandidaten (geo-data),
 * Coverage aus dem Ledger PLUS die noch nicht geschriebenen Bilanzen
 * fertiger Wellen dieses Jobs, Spillover-Auswahl (Kern vor Rand), Welle
 * nach Bedarf (tiles.planWave). Der Plan wird vom Aufrufer in den
 * Job-Params fixiert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCoverage, fetchSpillover } from "./coverage";
import { expandLocations, type LocationInput } from "./fanout";
import { resolveCityTiles } from "./geo-data";
import { interleave } from "./interleave";
import type { WebsiteFilterMode } from "./pipeline";
import {
  planWave,
  selectSpillover,
  spilloverEligibleTiles,
  type ChipCandidates,
  type CoverageRowLike,
  type TileCandidate,
  type WavePlan,
} from "./tiles";

export interface WaveRequest {
  userId: string;
  /** QUERY-Begriff (Kanonik oder Freitext) fuer die Tile-Queries. */
  industry: string;
  categoryCanon: string;
  country: string;
  locations: LocationInput[];
  websiteFilter: WebsiteFilterMode;
  maxSize: number;
}

export interface WaveState {
  /** Schon im Zwischenlager (fertige Wellen dieses Jobs). */
  deliveredSoFar: number;
  /** Coverage-Bilanzen fertiger Wellen — im Ledger erst beim Abschluss. */
  pendingCoverage: CoverageRowLike[];
  /** Spillover-Rows, die fruehere Wellen dieses Jobs schon verbraucht
   *  haben (geloescht werden sie erst beim Abschluss). */
  consumedSpilloverIds: ReadonlySet<string>;
}

export interface PlannedWave {
  plan: WavePlan;
  /** Fixierte Spillover-Auswahl (Kern-Tiles, Filter passend, <= Bedarf). */
  spilloverIds: string[];
  /** Kern-PLZ der Chips — Suchgebiet der Liefer-Sortierung. */
  candidatePostalCodes: string[];
}

/**
 * Naechste Welle planen. null = die Locations ergeben kein Ziel
 * (Region des falschen Landes etc. — die Route antwortet 400). Wirft bei
 * Infrastruktur-Fehlern (Postal-Daten, Ledger).
 */
export async function planNextWave(
  admin: SupabaseClient,
  request: WaveRequest,
  state: WaveState,
): Promise<PlannedWave | null> {
  const targets = expandLocations(request.locations, request.country);
  if (targets.length === 0) return null;

  // Tiles je Chip: ein Stadt-Chip bringt seine Tiles, ein State-Chip
  // zieht Round-Robin ueber die Tiles seiner Top-Staedte (Fairness auch
  // innerhalb des Chips).
  const tileLists = await Promise.all(
    targets.map((target) =>
      resolveCityTiles(admin, {
        industry: request.industry,
        country: request.country,
        target,
      }),
    ),
  );
  const byLocation = new Map<string, TileCandidate[][]>();
  targets.forEach((target, index) => {
    const lists = byLocation.get(target.location) ?? [];
    lists.push(tileLists[index]);
    byLocation.set(target.location, lists);
  });
  const chips: ChipCandidates[] = [...byLocation].map(([location, lists]) => ({
    location,
    tiles: interleave(lists),
  }));

  const [ledgerCoverage, spilloverRows] = await Promise.all([
    fetchCoverage(admin, request.userId, request.categoryCanon),
    fetchSpillover(admin, request.userId, request.categoryCanon),
  ]);
  const coverage = [...ledgerCoverage, ...state.pendingCoverage];

  // Spillover zaehlt ZUERST gegen den Restbedarf — nur Rows aus
  // Kern-Tiles (Rand erst, wenn der Kern durch ist), passender Filter,
  // und nicht schon von einer frueheren Welle dieses Jobs verbraucht.
  const remaining = Math.max(0, request.maxSize - state.deliveredSoFar);
  const spilloverPick = selectSpillover(
    spilloverRows.filter((row) => !state.consumedSpilloverIds.has(row.id)),
    spilloverEligibleTiles(chips, coverage, request.websiteFilter),
    request.websiteFilter,
    remaining,
  );

  const plan = planWave({
    chips,
    coverage,
    filter: request.websiteFilter,
    needed: remaining - spilloverPick.length,
  });

  // Suchgebiet fuer die Liefer-Sortierung: alle Kern-PLZ der Chips, nicht
  // nur die der Welle — ein Treffer im Nachbar-Tile derselben Stadt
  // gehoert dazu, ein Huerther Treffer einer Koeln-Query oder ein
  // "Springfield NJ" in einer Missouri-Suche nicht.
  const candidatePostalCodes = [
    ...new Set(
      chips.flatMap((chip) =>
        chip.tiles.flatMap((tile) =>
          tile.core && tile.postal_code ? [tile.postal_code] : [],
        ),
      ),
    ),
  ];

  return {
    plan,
    spilloverIds: spilloverPick.map((row) => row.id),
    candidatePostalCodes,
  };
}

/**
 * Server-Filter der Maps-Suche pro Website-Filter. Seit 2026-08-05
 * laeuft JEDER Markt mit language=en + Server-Filtern (Jan-Entscheidung;
 * Spec §6b/§14b): Server-Quick-Filter gibt es nur bei language=en, und
 * die A/B-Tests (Koeln/Wien/Paderborn) haben belegt, dass en weder
 * Firmen-Menge noch Adressen/Kategorien verschlechtert — Adressen
 * bleiben lokal ("Wien", nicht "Vienna"). Nur die working_hours-Tages-
 * Schluessel kommen englisch; die Pipeline uebersetzt sie in die
 * Markt-Sprache. Die Client-Pipeline laeuft als Garantie-Netz ohnehin
 * immer. Der Kostenhebel: beim Website-Filter (~5 % Trefferquote) werden
 * nur Treffer geliefert und berechnet statt des vollen Raw-Scans.
 *
 * Kein Enricher mehr in der Maps-Suche (Schritt 3, 2026-09-13): E-Mails
 * holt jobs.ts nach der letzten Welle nur fuer die gelieferten Betriebe
 * (lib/lists/enrichment.ts) — vorher zahlte jede Welle den Enricher auch
 * fuer Dubletten und Spillover.
 */
export function outscraperFiltersFor(filter: WebsiteFilterMode): string[] {
  const filters = ["with_phone", "operational_only"];
  if (filter === "without") filters.push("only_without_website");
  if (filter === "with") filters.push("only_with_website");
  return filters;
}
