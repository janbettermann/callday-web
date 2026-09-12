import { describe, expect, it } from "vitest";
import { assembleDelivery, buildTileOutcome } from "./delivery";
import type { OutscraperPlace } from "./outscraper";
import type { CallableLead } from "./pipeline";

const TILES = [
  { tile_id: "DE-50667", query: "Dentist, 50667, Köln", city: "Köln", location: "Köln" },
  { tile_id: "DE-50676", query: "Dentist, 50676, Köln", city: "Köln", location: "Köln" },
];

function place(
  name: string,
  phone: string,
  query: string,
  extra: Partial<OutscraperPlace> = {},
): OutscraperPlace {
  return {
    name,
    phone,
    query,
    business_status: "OPERATIONAL",
    place_id: `pid-${name}`,
    address: `Straße 1, 50667 Köln`,
    ...extra,
  };
}

function lead(
  name: string,
  phone: string,
  website: string | null = null,
): CallableLead {
  return {
    company_name: name,
    phone,
    email: null,
    website,
    contact_name: null,
    industry: "Zahnarzt",
    location: "Köln",
    custom_fields: {},
  };
}

function spill(id: string, tile: string, data: CallableLead) {
  return { id, tile_id: tile, lead_data: data };
}

const base = {
  knownPhoneKeys: new Set<string>(),
  maxSize: 3,
  websiteFilter: "any" as const,
  fallbackIndustry: "Dentist",
  marketLanguage: "de",
  plan: TILES,
  city: "Köln",
};

describe("assembleDelivery", () => {
  it("Spillover zuerst, dann die Welle im Round-Robin, Cap auf maxSize, Rest = Ueberschuss mit source_query", () => {
    const result = assembleDelivery({
      ...base,
      spillover: [
        spill("s1", "DE-50667", lead("S1", "+49 1")),
        spill("s2", "DE-50667", lead("S2", "+49 2")),
      ],
      places: [
        place("W1", "+49 11", TILES[0].query),
        place("W2", "+49 12", TILES[1].query),
        place("W3", "+49 13", TILES[0].query),
        place("W4", "+49 14", TILES[1].query),
      ],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["S1", "S2", "W1"]);
    expect(result.overflow.map((l) => l.company_name)).toEqual(["W2", "W3", "W4"]);
    expect(result.overflow[0].source_query).toBe(TILES[1].query);
    expect(result.consumedSpilloverIds).toEqual(["s1", "s2"]);
    expect(result.spilloverDelivered).toBe(2);
  });

  it("Spillover-Regeln: anderer Filter bleibt liegen, tote Rows werden aufgeraeumt, Cap gilt", () => {
    const result = assembleDelivery({
      ...base,
      websiteFilter: "without",
      maxSize: 1,
      knownPhoneKeys: new Set(["492"]),
      spillover: [
        spill("s1", "DE-50667", lead("Mit Website", "+49 1", "https://a.de")),
        spill("s2", "DE-50667", lead("Schon im Bestand", "+49 2")),
        spill("s3", "DE-50667", lead("Neu", "+49 3")),
        spill("s4", "DE-50676", lead("Dublette von Neu", "+49 (3)")),
        spill("s5", "DE-50676", lead("Naechster Lauf", "+49 5")),
      ],
      places: [],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["Neu"]);
    // s1 (Filter) und s5 (ueber Cap) bleiben fuer spaeter liegen.
    expect(result.consumedSpilloverIds).toEqual(["s2", "s3", "s4"]);
  });

  it("Welle dedupliziert gegen Bestand UND gelieferten Spillover — nichts davon landet im Ueberschuss", () => {
    const result = assembleDelivery({
      ...base,
      knownPhoneKeys: new Set(["4912"]),
      spillover: [spill("s1", "DE-50667", lead("S1", "+49 11"))],
      places: [
        place("Dublette Spillover", "+49 (11)", TILES[0].query),
        place("Dublette Bestand", "+49 12", TILES[0].query),
        place("W3", "+49 13", TILES[1].query),
      ],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["S1", "W3"]);
    expect(result.overflow).toHaveLength(0);
  });

  it("Spillover-only (keine Welle) liefert nur den Spillover", () => {
    const result = assembleDelivery({
      ...base,
      spillover: [spill("s1", "DE-50667", lead("S1", "+49 1"))],
      places: [],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["S1"]);
    expect(result.overflow).toHaveLength(0);
    expect(result.consumedSpilloverIds).toEqual(["s1"]);
  });

  it("Website-Filter greift auch auf die Welle (Garantie-Netz)", () => {
    const result = assembleDelivery({
      ...base,
      websiteFilter: "without",
      spillover: [],
      places: [
        place("Mit", "+49 11", TILES[0].query, { website: "https://a.de" }),
        place("Ohne", "+49 12", TILES[0].query),
      ],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["Ohne"]);
  });

  it("Alt-Job mit query_plan: city-first wie bisher, kein Spillover", () => {
    const plan = [{ query: "Dentist, Köln", city: "Köln", location: "Köln" }];
    const result = assembleDelivery({
      ...base,
      plan,
      spillover: [],
      places: [
        place("Umland", "+49 11", plan[0].query, { address: "Weg 2, Pulheim" }),
        place("Stadt", "+49 12", plan[0].query),
      ],
    });
    expect(result.leads.map((l) => l.company_name)).toEqual(["Stadt", "Umland"]);
  });
});

describe("buildTileOutcome", () => {
  it("zaehlt Plaetze pro Tile (0 fuer leere Tiles), ordnet Ueberschuss dem Tile zu und strippt source_query", () => {
    const outcome = buildTileOutcome({
      tiles: TILES,
      places: [
        place("A", "+49 1", TILES[0].query, { email: "x@a.de" }),
        place("A", "+49 1", TILES[0].query, { email: "y@a.de" }),
        place("B", "+49 2", TILES[0].query),
      ],
      overflow: [
        { ...lead("Rest", "+49 3"), source_query: TILES[1].query },
        { ...lead("Fremd", "+49 4"), source_query: "Dentist, Unbekannt" },
      ],
      limitUsed: 50,
      websiteFilter: "any",
    });
    expect(outcome.coverage).toEqual([
      { tile_id: "DE-50667", website_filter: "any", result_count: 2, limit_used: 50 },
      { tile_id: "DE-50676", website_filter: "any", result_count: 0, limit_used: 50 },
    ]);
    expect(outcome.spillover).toHaveLength(1);
    expect(outcome.spillover[0].tile_id).toBe("DE-50676");
    expect(outcome.spillover[0].lead_data).not.toHaveProperty("source_query");
    expect(outcome.spillover[0].lead_data.company_name).toBe("Rest");
  });
});
