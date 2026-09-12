import { describe, expect, it } from "vitest";
import { OUTSCRAPER_MAX_SCAN_LIMIT } from "./config";
import { normalizePlaceName } from "./normalize";
import {
  categoryCanon,
  cityTileId,
  classifyTile,
  haversineKm,
  MAX_WAVE_TILES,
  MIN_WAVE_TILES,
  orderPostalRows,
  planWave,
  postalTileId,
  selectSpillover,
  TILE_LIMIT_FRESH,
  TILE_LIMIT_RETRY,
  type ChipCandidates,
  type CoverageRowLike,
} from "./tiles";

describe("selectSpillover", () => {
  const rows = [
    { id: "1", tile_id: "DE-50667", lead_data: { website: "https://a.de" } },
    { id: "2", tile_id: "DE-50667", lead_data: { website: null } },
    { id: "3", tile_id: "DE-50354", lead_data: { website: null } },
    { id: "4", tile_id: "DE-50668", lead_data: { website: "https://b.de" } },
  ];
  const koeln = new Set(["DE-50667", "DE-50668"]);

  it("nur Tiles der aktuellen Suche, nur passender Filter, gecappt, Reihenfolge stabil", () => {
    expect(selectSpillover(rows, koeln, "any", 10).map((r) => r.id)).toEqual(
      ["1", "2", "4"],
    );
    expect(
      selectSpillover(rows, koeln, "without", 10).map((r) => r.id),
    ).toEqual(["2"]);
    expect(selectSpillover(rows, koeln, "any", 2).map((r) => r.id)).toEqual([
      "1",
      "2",
    ]);
    // Huerth-Suche sieht die Koeln-Leads nicht — trotz gleicher Branche.
    expect(
      selectSpillover(rows, new Set(["DE-50354"]), "any", 10).map((r) => r.id),
    ).toEqual(["3"]);
  });
});

// Echte Zentroide aus dem GeoNames-DE-Dump (2026-09-12).
const DOM = { lat: 50.9413, lng: 6.9583 };
const KOELN_ROWS = [
  { postal_code: "50354", place_name: "Hürth", lat: 50.8708, lng: 6.8676, search_names: ["hurth"] },
  { postal_code: "51103", place_name: "Köln", lat: 50.942, lng: 7.0166, search_names: ["koln"] },
  { postal_code: "51373", place_name: "Leverkusen", lat: 51.0303, lng: 6.9841, search_names: ["leverkusen"] },
  { postal_code: "50667", place_name: "Köln", lat: 50.9387, lng: 6.9547, search_names: ["koln"] },
  { postal_code: "50968", place_name: "Köln", lat: 50.898, lng: 6.964, search_names: ["koln"] },
];

describe("normalizePlaceName", () => {
  it("gleicht die Schreibweisen zwischen Geo-Asset und GeoNames an", () => {
    expect(normalizePlaceName("Halle (Saale)")).toBe("halle");
    expect(normalizePlaceName("St. Louis")).toBe("saint louis");
    expect(normalizePlaceName("Lee's Summit")).toBe("lees summit");
    expect(normalizePlaceName("Köln")).toBe("koln");
    expect(normalizePlaceName("Freiburg im Breisgau")).toBe(
      "freiburg im breisgau",
    );
  });
});

describe("Tile-Schluessel", () => {
  it("PLZ natuerlich, CITY-Fallback mit Land und normalisiertem Namen", () => {
    expect(postalTileId("DE", "50667")).toBe("DE-50667");
    expect(cityTileId("DE", "Köln")).toBe("CITY-DE-koln");
    expect(cityTileId("US", "St. Louis")).toBe("CITY-US-saint-louis");
  });

  it("categoryCanon: Zahnarzt-Aufloesung und Dentist treffen dieselbe Coverage", () => {
    expect(categoryCanon("Dentist")).toBe("dentist");
    expect(categoryCanon("  Tax   consultant ")).toBe("tax consultant");
  });
});

describe("orderPostalRows", () => {
  it("Namens-Treffer zuerst, darin nach Distanz zum Zentrum, Nachbargemeinden danach", () => {
    const ordered = orderPostalRows(KOELN_ROWS, DOM, "Köln").map(
      (r) => r.postal_code,
    );
    // Koeln: 50667 (0,3 km) < 51103 (4,1 km) < 50968 (4,8 km); dann
    // Huerth (~10 km) und Leverkusen (~10 km) nur ueber die Distanz.
    expect(ordered.slice(0, 3)).toEqual(["50667", "51103", "50968"]);
    expect(ordered.slice(3).sort()).toEqual(["50354", "51373"]);
  });

  it("ohne Namens-Treffer (Exonym) reine Distanz-Reihenfolge", () => {
    const ordered = orderPostalRows(KOELN_ROWS, DOM, "Cologne").map(
      (r) => r.postal_code,
    );
    expect(ordered[0]).toBe("50667");
    expect(ordered).toHaveLength(5);
  });

  it("haversine: Dom → Kalk rund 4 km", () => {
    expect(haversineKm(DOM, { lat: 50.942, lng: 7.0166 })).toBeCloseTo(4.1, 0);
  });
});

describe("classifyTile (Erschoepfungs-Semantik)", () => {
  const row = (
    partial: Partial<CoverageRowLike>,
  ): CoverageRowLike => ({
    tile_id: "DE-50667",
    website_filter: "any",
    result_count: 12,
    limit_used: TILE_LIMIT_FRESH,
    ...partial,
  });

  it("keine Row = fresh, klar unter Limit = closed, Limit oder knapp darunter = retry", () => {
    expect(classifyTile([], "any")).toBe("fresh");
    expect(classifyTile([row({ result_count: 12 })], "any")).toBe("closed");
    expect(classifyTile([row({ result_count: 50 })], "any")).toBe("retry");
    expect(classifyTile([row({ result_count: 0 })], "any")).toBe("closed");
    // dropDuplicates-Unschaerfe (live: 48/50 fuer eine Innenstadt-PLZ).
    expect(classifyTile([row({ result_count: 48 })], "any")).toBe("retry");
    expect(classifyTile([row({ result_count: 45 })], "any")).toBe("retry");
    expect(classifyTile([row({ result_count: 44 })], "any")).toBe("closed");
  });

  it("ein Retry-Lauf schliesst das Tile auch bei vollem Limit", () => {
    expect(
      classifyTile(
        [row({ result_count: TILE_LIMIT_RETRY, limit_used: TILE_LIMIT_RETRY })],
        "any",
      ),
    ).toBe("closed");
  });

  it("'any' deckt jeden Filter ab, ein Filter-Lauf deckt nur sich selbst", () => {
    const anyRun = [row({ website_filter: "any", result_count: 12 })];
    expect(classifyTile(anyRun, "without")).toBe("closed");
    expect(classifyTile(anyRun, "with")).toBe("closed");

    const withoutRun = [
      row({
        website_filter: "without",
        result_count: 3,
        limit_used: OUTSCRAPER_MAX_SCAN_LIMIT,
      }),
    ];
    expect(classifyTile(withoutRun, "without")).toBe("closed");
    expect(classifyTile(withoutRun, "any")).toBe("fresh");
    expect(classifyTile(withoutRun, "with")).toBe("fresh");
  });
});

describe("planWave", () => {
  const tile = (id: string, city = "Köln") => ({
    tile_id: id,
    query: `Dentist, ${id.slice(3)}, ${city}`,
    city,
  });
  const koeln: ChipCandidates = {
    location: "Köln",
    tiles: ["DE-50667", "DE-50668", "DE-50670", "DE-50672", "DE-50674"].map(
      (id) => tile(id),
    ),
  };
  const bonn: ChipCandidates = {
    location: "Bonn",
    tiles: ["DE-53111", "DE-53113", "DE-53115"].map((id) => tile(id, "Bonn")),
  };

  it("dimensioniert die Welle nach needed, geklammert auf 3..25", () => {
    const many: ChipCandidates = {
      location: "Berlin",
      tiles: Array.from({ length: 60 }, (_, i) =>
        tile(`DE-1${String(i).padStart(4, "0")}`, "Berlin"),
      ),
    };
    expect(
      planWave({ chips: [many], coverage: [], filter: "any", needed: 250 })
        .tiles,
    ).toHaveLength(13); // ceil(250 / 20)
    expect(
      planWave({ chips: [many], coverage: [], filter: "any", needed: 5 })
        .tiles,
    ).toHaveLength(MIN_WAVE_TILES);
    expect(
      planWave({ chips: [many], coverage: [], filter: "any", needed: 500 })
        .tiles,
    ).toHaveLength(MAX_WAVE_TILES);
  });

  it("zieht Round-Robin ueber die Chips und traegt die Chip-Location", () => {
    const plan = planWave({
      chips: [koeln, bonn],
      coverage: [],
      filter: "any",
      needed: 80, // ceil(80 / 20) = 4 Tiles
    });
    expect(plan.tiles.map((t) => t.location)).toEqual([
      "Köln",
      "Bonn",
      "Köln",
      "Bonn",
    ]);
    expect(plan.tiles[0]).toEqual({
      tile_id: "DE-50667",
      query: "Dentist, 50667, Köln",
      city: "Köln",
      location: "Köln",
    });
    expect(plan.limit).toBe(TILE_LIMIT_FRESH);
    expect(plan).toMatchObject({ total: 8, covered: 0, open: 8 });
  });

  it("ueberspringt erschoepfte Tiles und zaehlt sie als covered", () => {
    const coverage: CoverageRowLike[] = [
      { tile_id: "DE-50667", website_filter: "any", result_count: 9, limit_used: 50 },
      { tile_id: "DE-50668", website_filter: "any", result_count: 0, limit_used: 50 },
    ];
    const plan = planWave({ chips: [koeln], coverage, filter: "any", needed: 30 });
    expect(plan.tiles.map((t) => t.tile_id)).toEqual([
      "DE-50670",
      "DE-50672",
      "DE-50674",
    ]);
    expect(plan).toMatchObject({ total: 5, covered: 2, open: 3 });
  });

  it("Retry-Tiles kommen erst dran, wenn keine frischen mehr da sind — dann mit hohem Limit", () => {
    const full = (id: string): CoverageRowLike => ({
      tile_id: id,
      website_filter: "any",
      result_count: 50,
      limit_used: 50,
    });
    const mixed = planWave({
      chips: [koeln],
      coverage: [full("DE-50667"), full("DE-50668")],
      filter: "any",
      needed: 100,
    });
    expect(mixed.tiles.map((t) => t.tile_id)).toEqual([
      "DE-50670",
      "DE-50672",
      "DE-50674",
    ]);
    expect(mixed.limit).toBe(TILE_LIMIT_FRESH);

    const retryOnly = planWave({
      chips: [koeln],
      coverage: koeln.tiles.map((t) => full(t.tile_id)),
      filter: "any",
      needed: 100,
    });
    expect(retryOnly.tiles).toHaveLength(5);
    expect(retryOnly.limit).toBe(TILE_LIMIT_RETRY);
    expect(retryOnly.open).toBe(5);
  });

  it("alles abgehakt oder Spillover reicht → keine Welle", () => {
    const done = planWave({
      chips: [koeln],
      coverage: koeln.tiles.map((t) => ({
        tile_id: t.tile_id,
        website_filter: "any" as const,
        result_count: 1,
        limit_used: 50,
      })),
      filter: "any",
      needed: 100,
    });
    expect(done.tiles).toHaveLength(0);
    expect(done.open).toBe(0);
    expect(done.covered).toBe(5);

    const spilloverSuffices = planWave({
      chips: [koeln],
      coverage: [],
      filter: "any",
      needed: 0,
    });
    expect(spilloverSuffices.tiles).toHaveLength(0);
    expect(spilloverSuffices.open).toBe(5);
  });

  it("Website-Filter: Scan-Maximum als Limit (Scans sind gratis, Tile sicher erschoepft)", () => {
    const plan = planWave({
      chips: [koeln],
      coverage: [],
      filter: "without",
      needed: 30,
    });
    expect(plan.limit).toBe(OUTSCRAPER_MAX_SCAN_LIMIT);
  });

  it("CITY-Fallback-Tiles heben das Wellen-Limit auf das alte Stadt-Budget", () => {
    const fallback: ChipCandidates = {
      location: "Kleinstadt",
      tiles: [{ tile_id: "CITY-DE-kleinstadt", query: "Dentist, Kleinstadt", city: "Kleinstadt" }],
    };
    expect(
      planWave({ chips: [fallback], coverage: [], filter: "any", needed: 250 })
        .limit,
    ).toBe(350);
    expect(
      planWave({ chips: [fallback], coverage: [], filter: "any", needed: 10 })
        .limit,
    ).toBe(TILE_LIMIT_FRESH);
  });

  it("dasselbe Tile unter zwei Chips zaehlt nur einmal", () => {
    const twice = planWave({
      chips: [koeln, { location: "NRW", tiles: koeln.tiles.slice(0, 2) }],
      coverage: [],
      filter: "any",
      needed: 100,
    });
    expect(twice.total).toBe(5);
    expect(new Set(twice.tiles.map((t) => t.tile_id)).size).toBe(
      twice.tiles.length,
    );
  });
});
