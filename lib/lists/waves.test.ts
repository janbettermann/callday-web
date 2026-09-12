import { describe, expect, it } from "vitest";
import { MAX_WAVES, rollupWaves, shouldChain, type WaveSummary } from "./waves";

describe("shouldChain", () => {
  it("faehrt weiter, solange die Liste nicht voll ist, Wellen uebrig sind und die letzte Welle etwas brachte", () => {
    expect(shouldChain({ deliveredTotal: 12, maxSize: 30, wave: 1, lastWaveDelivered: 12 })).toBe(true);
    expect(shouldChain({ deliveredTotal: 30, maxSize: 30, wave: 1, lastWaveDelivered: 30 })).toBe(false);
    expect(shouldChain({ deliveredTotal: 12, maxSize: 30, wave: MAX_WAVES, lastWaveDelivered: 12 })).toBe(false);
    expect(shouldChain({ deliveredTotal: 29, maxSize: 30, wave: 2, lastWaveDelivered: 1 })).toBe(true);
    // Nullrunde: die naechste Welle waere auch eine.
    expect(shouldChain({ deliveredTotal: 18, maxSize: 30, wave: 2, lastWaveDelivered: 0 })).toBe(false);
  });
});

describe("rollupWaves", () => {
  it("summiert Leads, Rohzeilen, Coverage und verbrauchten Spillover ueber die Wellen", () => {
    const waves: WaveSummary[] = [
      {
        wave: 1,
        request_id: "a-1",
        tiles: 2,
        limit: 21,
        places: 40,
        delivered: 12,
        coverage: [
          { tile_id: "DE-50667", website_filter: "any", result_count: 21, limit_used: 21 },
          { tile_id: "DE-50676", website_filter: "any", result_count: 9, limit_used: 21 },
        ],
        consumed_spillover_ids: ["s1"],
      },
      {
        wave: 2,
        request_id: "a-2",
        tiles: 1,
        limit: 26,
        places: 15,
        delivered: 8,
        coverage: [
          { tile_id: "DE-50679", website_filter: "any", result_count: 15, limit_used: 26 },
        ],
        consumed_spillover_ids: [],
      },
    ];
    expect(rollupWaves(waves)).toEqual({
      delivered: 20,
      places: 55,
      coverage: [...waves[0].coverage, ...waves[1].coverage],
      consumedSpilloverIds: ["s1"],
    });
    expect(rollupWaves(undefined)).toEqual({
      delivered: 0,
      places: 0,
      coverage: [],
      consumedSpilloverIds: [],
    });
  });
});
