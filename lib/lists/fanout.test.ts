import { describe, expect, it } from "vitest";
import {
  buildQueryPlan,
  computePerQueryLimit,
  MAX_LOCATIONS,
} from "./fanout";
import { GEO_REGIONS, getRegion, searchRegions } from "./geo-regions";
import { findCountry } from "./countries";

describe("GEO_REGIONS (Asset-Integritaet)", () => {
  it("IDs sind eindeutig und folgen dem <LAND>-<CODE>-Schema", () => {
    const ids = GEO_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const region of GEO_REGIONS) {
      expect(region.id.startsWith(`${region.country}-`)).toBe(true);
    }
  });

  it("jedes Land ist ein gueltiger ISO-Code mit Staedten pro Region", () => {
    for (const region of GEO_REGIONS) {
      expect(findCountry(region.country), region.id).not.toBeNull();
      expect(region.cities.length, region.id).toBeGreaterThanOrEqual(5);
      const lower = region.cities.map((c) => c.toLowerCase());
      expect(new Set(lower).size, `${region.id} Staedte-Dubletten`).toBe(
        lower.length,
      );
    }
  });

  it("deckt alle US-States und die deutschen Flaechenlaender ab", () => {
    expect(GEO_REGIONS.filter((r) => r.country === "US")).toHaveLength(50);
    expect(GEO_REGIONS.filter((r) => r.country === "DE")).toHaveLength(13);
    expect(GEO_REGIONS.filter((r) => r.country === "AT")).toHaveLength(8);
  });
});

describe("searchRegions", () => {
  it("matcht Name und Aliase diakritik-tolerant, aufs Land gefiltert", () => {
    expect(searchRegions("bayern", "DE")[0]?.id).toBe("DE-BY");
    expect(searchRegions("bavaria", "DE")[0]?.id).toBe("DE-BY");
    expect(searchRegions("wurttemberg", "DE")[0]?.id).toBe("DE-BW");
    expect(searchRegions("tx", "US")[0]?.id).toBe("US-TX");
    expect(searchRegions("bayern", "US")).toHaveLength(0);
    expect(searchRegions("bayern", null)).toHaveLength(0);
  });
});

describe("buildQueryPlan", () => {
  it("Stadt-Chips bleiben im alten Query-Format, Regionen faechern mit State-Namen auf", () => {
    const plan = buildQueryPlan(
      "Dentist",
      [{ name: "Köln" }, { name: "Bayern", region_id: "DE-BY" }],
      "DE",
    );
    expect(plan[0]).toEqual({
      query: "Dentist, Köln",
      city: "Köln",
      location: "Köln",
    });
    const bavaria = plan.filter((e) => e.location === "Bayern");
    expect(bavaria[0].query).toBe("Dentist, München, Bayern");
    expect(bavaria).toHaveLength(12); // 1 Region → volle Tiefe
  });

  it("skaliert die Staedte-Tiefe mit der Region-Anzahl", () => {
    const twoRegions = buildQueryPlan(
      "Dentist",
      [
        { name: "Bayern", region_id: "DE-BY" },
        { name: "Hessen", region_id: "DE-HE" },
      ],
      "DE",
    );
    expect(twoRegions.filter((e) => e.location === "Bayern")).toHaveLength(8);

    const fiveRegions = buildQueryPlan(
      "Dentist",
      ["DE-BY", "DE-HE", "DE-NW", "DE-BW", "DE-NI"].map((id) => ({
        name: id,
        region_id: id,
      })),
      "DE",
    );
    expect(fiveRegions).toHaveLength(25); // 5 × 5
  });

  it("ignoriert Regionen des falschen Landes und kappt bei MAX_LOCATIONS", () => {
    const plan = buildQueryPlan(
      "Dentist",
      [
        { name: "Texas", region_id: "US-TX" },
        ...Array.from({ length: 7 }, (_, i) => ({ name: `Stadt ${i}` })),
      ],
      "DE",
    );
    // US-TX faellt raus (Land DE), von 7 Staedten bleiben 4 (Cap 5 gesamt).
    expect(plan.every((e) => e.location.startsWith("Stadt"))).toBe(true);
    expect(plan).toHaveLength(MAX_LOCATIONS - 1);
  });
});

describe("computePerQueryLimit", () => {
  it("ohne Website-Filter: eng an der Wunschgroesse, Floor 15, Cap 400", () => {
    expect(computePerQueryLimit(250, 1, false)).toBe(350);
    expect(computePerQueryLimit(250, 25, false)).toBe(15);
    expect(computePerQueryLimit(500, 1, false)).toBe(400);
  });

  it("mit Website-Filter: grosszuegig scannen (Scans sind quasi gratis)", () => {
    expect(computePerQueryLimit(250, 25, true)).toBe(200);
    expect(computePerQueryLimit(250, 1, true)).toBe(500);
    expect(computePerQueryLimit(20, 25, true)).toBe(60);
  });
});
