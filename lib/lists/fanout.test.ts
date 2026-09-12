import { describe, expect, it } from "vitest";
import { cityQuery, expandLocations, MAX_LOCATIONS } from "./fanout";
import { GEO_REGIONS, searchRegions } from "./geo-regions";
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

describe("expandLocations", () => {
  it("Stadt-Chips bleiben eine Stadt (mit place_id), Regionen faechern in Top-Staedte auf", () => {
    const targets = expandLocations(
      [
        { name: "Köln", place_id: "ChIJ5S-raZElv0cR8HcqSvxgJwQ" },
        { name: "Bayern", region_id: "DE-BY" },
      ],
      "DE",
    );
    expect(targets[0]).toMatchObject({
      city: "Köln",
      location: "Köln",
      region: null,
      place_id: "ChIJ5S-raZElv0cR8HcqSvxgJwQ",
    });
    const bavaria = targets.filter((t) => t.location === "Bayern");
    expect(bavaria).toHaveLength(12); // 1 Region → volle Tiefe
    expect(bavaria[0]).toMatchObject({ city: "München", place_id: null });
    expect(bavaria[0].region?.id).toBe("DE-BY");
  });

  it("skaliert die Staedte-Tiefe mit der Region-Anzahl", () => {
    const twoRegions = expandLocations(
      [
        { name: "Bayern", region_id: "DE-BY" },
        { name: "Hessen", region_id: "DE-HE" },
      ],
      "DE",
    );
    expect(twoRegions.filter((t) => t.location === "Bayern")).toHaveLength(8);

    const fiveRegions = expandLocations(
      ["DE-BY", "DE-HE", "DE-NW", "DE-BW", "DE-NI"].map((id) => ({
        name: id,
        region_id: id,
      })),
      "DE",
    );
    expect(fiveRegions).toHaveLength(25); // 5 × 5
  });

  it("ignoriert Regionen des falschen Landes und kappt bei MAX_LOCATIONS", () => {
    const targets = expandLocations(
      [
        { name: "Texas", region_id: "US-TX" },
        ...Array.from({ length: 7 }, (_, i) => ({ name: `Stadt ${i}` })),
      ],
      "DE",
    );
    // US-TX faellt raus (Land DE), von 7 Staedten bleiben 4 (Cap 5 gesamt).
    expect(targets.every((t) => t.location.startsWith("Stadt"))).toBe(true);
    expect(targets).toHaveLength(MAX_LOCATIONS - 1);
  });
});

describe("cityQuery (CITY-Fallback-Format)", () => {
  it("Stadt-Chip im alten Format, Region-Stadt mit State-Namen", () => {
    const [koeln, muenchen] = expandLocations(
      [{ name: "Köln" }, { name: "Bayern", region_id: "DE-BY" }],
      "DE",
    );
    expect(cityQuery("Dentist", koeln)).toBe("Dentist, Köln");
    expect(cityQuery("Dentist", muenchen)).toBe("Dentist, München, Bayern");
  });
});
