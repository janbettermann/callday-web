import { describe, expect, it } from "vitest";
import {
  aggregatePostalCodes,
  parseGeoNamesLine,
  postalDisplayName,
  postalSearchKeys,
} from "./geonames";

const koeln =
  "DE\t50667\tKöln\tNordrhein-Westfalen\tNW\tRegierungsbezirk Köln\t053\tKöln, Stadt\t05315\t50.9387\t6.9547\t6";
const daimler =
  "DE\t10875\tDaimler Brand und IP Management GmbH & Co.KG\tBaden-Württemberg\t01\tRegierungsbezirk Stuttgart\t081\tStadtkreis Stuttgart\t08111\t48.7239\t9.1699\t";
const wien =
  "AT\t1010\tWien, Innere Stadt\tWien\t09\tPolitischer Bezirk Wien (Stadt)\t900\tGemeindebezirk Innere Stadt\t901\t48.2085\t16.3721\t1";
const stLouisA =
  "US\t63101\tSaint Louis\tMissouri\tMO\tSaint Louis (city)\t510\t\t\t38.6313\t-90.1921\t4";
const stLouisB =
  "US\t63101\tSaint Louis\tMissouri\tMO\tSaint Louis (city)\t510\t\t\t38.6413\t-90.2021\t4";
const aarau =
  "CH\t5001\tAarau 1\tKanton Aargau\tAG\tBezirk Aarau\t1901\tAarau\t4001\t47.3888\t8.0483\t";

describe("parseGeoNamesLine", () => {
  it("liest die 12 Dump-Spalten", () => {
    expect(parseGeoNamesLine(koeln)).toEqual({
      country: "DE",
      postal_code: "50667",
      place_name: "Köln",
      admin1: "Nordrhein-Westfalen",
      lat: 50.9387,
      lng: 6.9547,
      accuracy: "6",
    });
  });

  it("verwirft kaputte Zeilen statt zu raten", () => {
    expect(parseGeoNamesLine("")).toBeNull();
    expect(parseGeoNamesLine("DE\t50667\tKöln")).toBeNull();
    expect(
      parseGeoNamesLine("DE\t50667\tKöln\t\t\t\t\t\t\tabc\t6.95\t6"),
    ).toBeNull();
  });
});

describe("postalDisplayName / postalSearchKeys", () => {
  it("schneidet Bezirks-Zusaetze hinterm Komma ab", () => {
    expect(postalDisplayName("Wien, Innere Stadt")).toBe("Wien");
    expect(postalDisplayName("Graz,02.Bez.:Sankt Leonhard")).toBe("Graz");
    expect(postalDisplayName("Köln")).toBe("Köln");
  });

  it("liefert vollen + kurzen Schluessel, tolerant normalisiert", () => {
    expect(postalSearchKeys("Wien, Innere Stadt")).toEqual([
      "wien, innere stadt",
      "wien",
    ]);
    expect(postalSearchKeys("Halle (Saale)")).toEqual(["halle"]);
    expect(postalSearchKeys("St. Louis")).toEqual(["saint louis"]);
  });
});

describe("aggregatePostalCodes", () => {
  it("wirft deutsche Grossempfaenger-PLZ (ohne Accuracy) raus, behaelt CH/US-Zeilen ohne Accuracy", () => {
    const rows = aggregatePostalCodes(
      [koeln, daimler, aarau].map((l) => parseGeoNamesLine(l)!),
    );
    expect(rows.map((r) => `${r.country}-${r.postal_code}`)).toEqual([
      "DE-50667",
      "CH-5001",
    ]);
  });

  it("aggregiert mehrere Zeilen einer PLZ: Mittelwert-Zentroid, erster Name, alle Suchschluessel", () => {
    const rows = aggregatePostalCodes(
      [stLouisA, stLouisB, wien].map((l) => parseGeoNamesLine(l)!),
    );
    const stl = rows.find((r) => r.postal_code === "63101")!;
    expect(stl.lat).toBeCloseTo(38.6363, 4);
    expect(stl.lng).toBeCloseTo(-90.1971, 4);
    expect(stl.place_name).toBe("Saint Louis");
    expect(stl.admin1).toBe("Missouri");
    expect(stl.search_names).toEqual(["saint louis"]);

    const at = rows.find((r) => r.country === "AT")!;
    expect(at.place_name).toBe("Wien");
    expect(at.search_names).toContain("wien");
  });
});
