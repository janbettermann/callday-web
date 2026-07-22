import { describe, expect, it } from "vitest";
import {
  GMB_CATEGORIES,
  isKnownCategory,
  searchCategories,
} from "./gmb-categories";

describe("searchCategories", () => {
  it("liefert nichts unter 2 Zeichen", () => {
    expect(searchCategories("")).toEqual([]);
    expect(searchCategories("d")).toEqual([]);
    expect(searchCategories(" d ")).toEqual([]);
  });

  it("matcht case-insensitiv als Substring", () => {
    expect(searchCategories("DENT")).toContain("Dentist");
    expect(searchCategories("roof")).toContain("Roofing contractor");
  });

  it("reiht Prefix-Treffer vor Mitte-Treffern", () => {
    const results = searchCategories("den");
    const prefix = results.indexOf("Dentist");
    const mid = results.indexOf("Garden center");
    expect(prefix).toBeGreaterThanOrEqual(0);
    if (mid !== -1) expect(prefix).toBeLessThan(mid);
  });

  it("kappt bei 8 Vorschlaegen", () => {
    expect(searchCategories("co").length).toBeLessThanOrEqual(8);
  });

  it("hat keine Dubletten in der Liste", () => {
    const lower = GMB_CATEGORIES.map((c) => c.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});

describe("isKnownCategory", () => {
  it("erkennt Listen-Eintraege case-insensitiv", () => {
    expect(isKnownCategory("dentist")).toBe(true);
    expect(isKnownCategory("  Law firm ")).toBe(true);
  });

  it("lehnt Freitext und Leeres ab", () => {
    expect(isKnownCategory("Fahrschulen")).toBe(false);
    expect(isKnownCategory("")).toBe(false);
  });

  it("erkennt alle Chip-Vorschlaege (Haekchen-Garantie)", async () => {
    const { INDUSTRY_SUGGESTIONS } = await import("./config");
    for (const suggestion of INDUSTRY_SUGGESTIONS) {
      expect(isKnownCategory(suggestion)).toBe(true);
    }
  });
});
