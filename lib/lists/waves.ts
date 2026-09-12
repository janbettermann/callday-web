/**
 * Nachschlag-Wellen (Spec §14b.1 Schritt 2, Jan 2026-09-13) — die PUREN
 * Regeln: wann ein Job nach einer Welle weiterfaehrt und wie die
 * Zwischenstaende der fertigen Wellen zusammengefasst werden. I/O
 * (Zwischenlager, Planung, Outscraper) lebt in staging.ts,
 * wave-planner.ts und jobs.ts.
 *
 * Warum: eine Welle kauft nach Bedarf (tiles.ts) und kann deshalb
 * unter der Max-Listengroesse landen — duenne Branche, Filter,
 * Dubletten. Wer "Dentist, Bayern, 250" eingibt, erwartet 250, nicht
 * eine stille 180er-Liste. Der Job faehrt dann mit dem Restbedarf
 * weiter, hoechstens MAX_WAVES mal, und liefert am Ende EINE Liste.
 * Nichts ist bis zum Abschluss irreversibel: Leads fertiger Wellen
 * warten im Zwischenlager, Coverage und Spillover-Verbrauch werden erst
 * beim Abschluss geschrieben. Faellt eine spaetere Welle aus, wird mit
 * dem Stand davor abgeschlossen.
 */

import type { TileOutcome } from "./delivery";

/** Hoechstens drei Umlaeufe pro Job — jeder kostet Outscraper-Zeit (1–8 min). */
export const MAX_WAVES = 3;

/** Bilanz einer fertig verarbeiteten Welle (params.waves_done). */
export interface WaveSummary {
  wave: number;
  request_id: string | null;
  tiles: number;
  limit: number;
  /** Outscraper-Rohzeilen der Welle (Kostenmass, wie raw_count). */
  places: number;
  /** In dieser Welle ins Zwischenlager gelegte Leads. */
  delivered: number;
  /** Coverage-Rows der Welle — erst beim Abschluss in den Ledger. */
  coverage: TileOutcome["coverage"];
  /** Verbrauchte Spillover-Rows — erst beim Abschluss geloescht. */
  consumed_spillover_ids: string[];
}

/**
 * Weiterfahren, wenn die Liste noch nicht voll ist, noch Wellen uebrig
 * sind UND die letzte Welle ueberhaupt etwas Neues gebracht hat: bei
 * duennen Branchen liefert Google fuer jede PLZ der Stadt dieselben
 * paar Betriebe (live: Tattoo-Studios Bonn — Welle 2 und 3 kauften 37
 * Rohzeilen fuer 0 neue Leads). Eine Nullrunde heisst, die naechste
 * waere auch eine. Ob es noch offene Tiles gibt, entscheidet die Planung
 * der naechsten Welle (leerer Plan = Schluss).
 */
export function shouldChain(input: {
  deliveredTotal: number;
  maxSize: number;
  wave: number;
  /** Neue Leads der gerade verarbeiteten Welle. */
  lastWaveDelivered: number;
  maxWaves?: number;
}): boolean {
  const maxWaves = input.maxWaves ?? MAX_WAVES;
  return (
    input.deliveredTotal < input.maxSize &&
    input.wave < maxWaves &&
    input.lastWaveDelivered > 0
  );
}

export interface WavesRollup {
  delivered: number;
  places: number;
  coverage: TileOutcome["coverage"];
  consumedSpilloverIds: string[];
}

/** Summen ueber die fertigen Wellen — fuer Abschluss, Copy und Admin. */
export function rollupWaves(waves: WaveSummary[] | undefined): WavesRollup {
  const rollup: WavesRollup = {
    delivered: 0,
    places: 0,
    coverage: [],
    consumedSpilloverIds: [],
  };
  for (const wave of waves ?? []) {
    rollup.delivered += wave.delivered;
    rollup.places += wave.places;
    rollup.coverage.push(...wave.coverage);
    rollup.consumedSpilloverIds.push(...wave.consumed_spillover_ids);
  }
  return rollup;
}
