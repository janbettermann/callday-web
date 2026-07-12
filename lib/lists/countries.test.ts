import { describe, expect, it } from "vitest";
import {
  findCountry,
  listCountryOptions,
  searchCountries,
} from "./countries";

describe("findCountry", () => {
  it("liefert Config mit Sprache fuer gueltige Codes (case-insensitiv)", () => {
    expect(findCountry("de")).toEqual({
      code: "DE",
      label: "Germany",
      language: "de",
    });
    expect(findCountry("US")?.language).toBe("en");
  });

  it("lehnt unbekannte Codes und Nicht-Strings ab", () => {
    expect(findCountry("XX")).toBeNull();
    expect(findCountry(42)).toBeNull();
    expect(findCountry(undefined)).toBeNull();
  });
});

describe("listCountryOptions", () => {
  it("stellt die Kern-Maerkte an den Anfang", () => {
    const codes = listCountryOptions().map((o) => o.code);
    expect(codes.slice(0, 4)).toEqual(["DE", "AT", "CH", "US"]);
  });
});

describe("searchCountries", () => {
  it("zeigt ohne Eingabe die Kern-Maerkte zuerst, gecappt", () => {
    const options = searchCountries("", 8);
    expect(options).toHaveLength(8);
    expect(options.slice(0, 4).map((o) => o.code)).toEqual([
      "DE",
      "AT",
      "CH",
      "US",
    ]);
  });

  it("sortiert Prefix-Treffer vor Substring-Treffern", () => {
    const labels = searchCountries("ger").map((o) => o.label);
    expect(labels[0]).toBe("Germany");
    expect(labels).toContain("Algeria");
    expect(labels.indexOf("Germany")).toBeLessThan(labels.indexOf("Algeria"));
  });

  it("findet nichts bei Unsinn", () => {
    expect(searchCountries("zzzzzz")).toEqual([]);
  });
});
