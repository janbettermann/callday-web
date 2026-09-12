import { describe, expect, it } from "vitest";
import { OUTSCRAPER_MAX_SCAN_LIMIT } from "./config";
import { normalizePlaceName } from "./normalize";
import {
  categoryCanon,
  cityTileId,
  classifyTile,
  exhaustionSlack,
  haversineKm,
  MAX_WAVE_TILES,
  orderPostalRows,
  planWave,
  postalTileId,
  selectSpillover,
  spilloverEligibleTiles,
  TILE_LIMIT_MAX,
  TILE_LIMIT_MIN,
  TILE_LIMIT_RETRY_MAX,
  tilesForNeed,
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

describe("spilloverEligibleTiles (Kern vor Rand)", () => {
  const chips = [
    {
      location: "Köln",
      tiles: [
        { tile_id: "DE-50667", query: "q", city: "Köln", core: true },
        { tile_id: "DE-50668", query: "q", city: "Köln", core: true },
        { tile_id: "DE-50354", query: "q", city: "Hürth", core: false },
      ],
    },
  ];
  const closed = (id: string): CoverageRowLike => ({
    tile_id: id,
    website_filter: "any",
    result_count: 3,
    limit_used: 50,
  });

  it("Rand-Tiles liefern keinen Spillover, solange ein Kern-Tile unbesucht ist", () => {
    expect([...spilloverEligibleTiles(chips, [], "any")]).toEqual([
      "DE-50667",
      "DE-50668",
    ]);
    expect([...spilloverEligibleTiles(chips, [closed("DE-50667")], "any")]).toEqual([
      "DE-50667",
      "DE-50668",
    ]);
  });

  it("ist der Kern durch, kommt der Rand dazu", () => {
    expect(
      [...spilloverEligibleTiles(chips, [closed("DE-50667"), closed("DE-50668")], "any")],
    ).toEqual(["DE-50667", "DE-50668", "DE-50354"]);
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
    limit_used: TILE_LIMIT_MAX,
    ...partial,
  });

  it("Puffer ist proportional zum Limit: 10 %, min 2, max 20", () => {
    expect(exhaustionSlack(15)).toBe(2);
    expect(exhaustionSlack(21)).toBe(2);
    expect(exhaustionSlack(30)).toBe(3);
    expect(exhaustionSlack(50)).toBe(5);
    expect(exhaustionSlack(200)).toBe(20);
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
    // Bei Limit 15 ist der Puffer 2.
    expect(classifyTile([row({ result_count: 13, limit_used: 15 })], "any")).toBe("retry");
    expect(classifyTile([row({ result_count: 12, limit_used: 15 })], "any")).toBe("closed");
  });

  it("ein Lauf mit dem Retry-Deckel schliesst das Tile auch bei vollem Limit", () => {
    expect(
      classifyTile(
        [row({ result_count: TILE_LIMIT_RETRY_MAX, limit_used: TILE_LIMIT_RETRY_MAX })],
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
    core: true,
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
  const many: ChipCandidates = {
    location: "Berlin",
    tiles: Array.from({ length: 60 }, (_, i) =>
      tile(`DE-1${String(i).padStart(4, "0")}`, "Berlin"),
    ),
  };
  const plan = (chips: ChipCandidates[], needed: number, coverage: CoverageRowLike[] = [], filter: "any" | "without" = "any") =>
    planWave({ chips, coverage, filter, needed });

  it("Tile-Zahl und Limit folgen dem Bedarf — keine Untergrenze, Marge 1,4", () => {
    expect(tilesForNeed(250, "any")).toBe(13);
    expect(tilesForNeed(30, "any")).toBe(2);
    expect(tilesForNeed(10, "any")).toBe(1);
    expect(tilesForNeed(500, "any")).toBe(MAX_WAVE_TILES);

    const big = plan([many], 250);
    expect(big.tiles).toHaveLength(13);
    expect(big.limit).toBe(27); // ceil(250 × 1,4 / 13)

    const mid = plan([many], 30);
    expect(mid.tiles).toHaveLength(2);
    expect(mid.limit).toBe(21); // ceil(42 / 2)

    const tiny = plan([many], 10);
    expect(tiny.tiles).toHaveLength(1);
    expect(tiny.limit).toBe(TILE_LIMIT_MIN); // 14 → Boden 15

    expect(plan([many], 25).tiles).toHaveLength(2);
    expect(plan([many], 500).tiles).toHaveLength(MAX_WAVE_TILES);
    expect(plan([many], 500).limit).toBe(28);
  });

  it("weniger frische Tiles als geplant → tiefer pro Tile, gedeckelt bei 50", () => {
    const koelnDeep = plan([koeln], 250); // 13 geplant, 5 da
    expect(koelnDeep.tiles).toHaveLength(5);
    expect(koelnDeep.limit).toBe(TILE_LIMIT_MAX); // ceil(350 / 5) = 70 → 50

    const single: ChipCandidates = { location: "Hürth", tiles: [tile("DE-50354", "Hürth")] };
    const huerth = plan([single], 30);
    expect(huerth.tiles).toHaveLength(1);
    expect(huerth.limit).toBe(42);
  });

  it("zieht Round-Robin ueber die Chips und traegt die Chip-Location", () => {
    const result = plan([koeln, bonn], 80); // ceil(80 / 20) = 4 Tiles
    expect(result.tiles.map((t) => t.location)).toEqual([
      "Köln",
      "Bonn",
      "Köln",
      "Bonn",
    ]);
    expect(result.tiles[0]).toEqual({
      tile_id: "DE-50667",
      query: "Dentist, 50667, Köln",
      city: "Köln",
      location: "Köln",
    });
    expect(result.limit).toBe(28); // ceil(112 / 4)
    expect(result).toMatchObject({ total: 8, covered: 0, visited: 0, open: 8 });
  });

  it("ueberspringt erschoepfte Tiles und zaehlt sie als covered + visited", () => {
    const coverage: CoverageRowLike[] = [
      { tile_id: "DE-50667", website_filter: "any", result_count: 9, limit_used: 50 },
      { tile_id: "DE-50668", website_filter: "any", result_count: 0, limit_used: 50 },
    ];
    const result = plan([koeln], 30, coverage);
    expect(result.tiles.map((t) => t.tile_id)).toEqual(["DE-50670", "DE-50672"]);
    expect(result).toMatchObject({ total: 5, covered: 2, visited: 2, open: 3 });
  });

  it("Retry-Tiles kommen erst dran, wenn keine frischen mehr da sind — progressiv nachgekauft", () => {
    const full = (id: string, limit = 50): CoverageRowLike => ({
      tile_id: id,
      website_filter: "any",
      result_count: limit,
      limit_used: limit,
    });
    const mixed = plan([koeln], 100, [full("DE-50667"), full("DE-50668")]);
    expect(mixed.tiles.map((t) => t.tile_id)).toEqual([
      "DE-50670",
      "DE-50672",
      "DE-50674",
    ]);
    expect(mixed.limit).toBe(47); // frisch: ceil(140 / 3)
    expect(mixed).toMatchObject({ visited: 2, covered: 0, open: 5 });

    const retryOnly = plan([koeln], 100, koeln.tiles.map((t) => full(t.tile_id)));
    expect(retryOnly.tiles).toHaveLength(5);
    expect(retryOnly.limit).toBe(78); // 50 + ceil(140 / 5) — naechste Schicht, nicht 200
    expect(retryOnly).toMatchObject({ visited: 5, open: 5 });

    // Tiefstes bisheriges Limit der Welle ist die Basis; Deckel 200.
    const layered = plan(
      [{ location: "Köln", tiles: koeln.tiles.slice(0, 2) }],
      30,
      [full("DE-50667", 25), full("DE-50668", 46)],
    );
    expect(layered.limit).toBe(67); // 46 + ceil(42 / 2)
    const capped = plan(
      [{ location: "Köln", tiles: koeln.tiles.slice(0, 1) }],
      30,
      [full("DE-50667", 190)],
    );
    expect(capped.limit).toBe(TILE_LIMIT_RETRY_MAX);
  });

  it("alles abgehakt oder Spillover reicht → keine Welle", () => {
    const done = plan(
      [koeln],
      100,
      koeln.tiles.map((t) => ({
        tile_id: t.tile_id,
        website_filter: "any" as const,
        result_count: 1,
        limit_used: 50,
      })),
    );
    expect(done.tiles).toHaveLength(0);
    expect(done).toMatchObject({ open: 0, covered: 5, visited: 5 });

    const spilloverSuffices = plan([koeln], 0);
    expect(spilloverSuffices.tiles).toHaveLength(0);
    expect(spilloverSuffices).toMatchObject({ open: 5, visited: 0 });
  });

  it("Website-Filter: mehr Tiles pro Welle, Scan-Maximum als Limit", () => {
    expect(tilesForNeed(30, "without")).toBe(6);
    expect(tilesForNeed(250, "without")).toBe(MAX_WAVE_TILES);
    const filtered = plan([koeln], 30, [], "without");
    expect(filtered.tiles).toHaveLength(5); // 6 geplant, 5 da
    expect(filtered.limit).toBe(OUTSCRAPER_MAX_SCAN_LIMIT);
  });

  it("CITY-Fallback-Tiles bekommen das alte Stadt-Budget (×1,4, Cap 400)", () => {
    const fallback: ChipCandidates = {
      location: "Kleinstadt",
      tiles: [{ tile_id: "CITY-DE-kleinstadt", query: "Dentist, Kleinstadt", city: "Kleinstadt", core: true }],
    };
    expect(plan([fallback], 250).limit).toBe(350);
    expect(plan([fallback], 10).limit).toBe(TILE_LIMIT_MIN);
  });

  it("dasselbe Tile unter zwei Chips zaehlt nur einmal", () => {
    const twice = plan([koeln, { location: "NRW", tiles: koeln.tiles.slice(0, 2) }], 100);
    expect(twice.total).toBe(5);
    expect(new Set(twice.tiles.map((t) => t.tile_id)).size).toBe(
      twice.tiles.length,
    );
  });
});
