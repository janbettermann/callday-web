import { describe, expect, it } from "vitest";
import {
  GMB_CATEGORIES,
  isKnownCategory,
  searchCategories,
} from "./gmb-categories";
import { CATEGORY_ALIASES } from "./category-aliases";

/** Nur die Werte der Vorschlaege — fuer Enthaltensein-Checks. */
const values = (query: string) => searchCategories(query).map((s) => s.value);

describe("searchCategories", () => {
  it("liefert nichts unter 2 Zeichen", () => {
    expect(searchCategories("")).toEqual([]);
    expect(searchCategories("d")).toEqual([]);
    expect(searchCategories(" d ")).toEqual([]);
  });

  it("matcht case-insensitiv als Substring", () => {
    expect(values("DENT")).toContain("Dentist");
    expect(values("roof")).toContain("Roofing contractor");
  });

  it("reiht Prefix-Treffer vor Mitte-Treffern", () => {
    const results = values("den");
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

  it("Direkt-Treffer erscheinen ohne Sublabel", () => {
    const dentist = searchCategories("dentist").find(
      (s) => s.value === "Dentist",
    );
    expect(dentist).toEqual({ value: "Dentist", label: "Dentist" });
  });
});

describe("Alias-Suche (deutsch)", () => {
  it("matcht deutsche Aliase und setzt die englische Kanonik als value", () => {
    const first = searchCategories("zahnarzt")[0];
    expect(first).toEqual({
      value: "Dentist",
      label: "Zahnarzt",
      sublabel: "Dentist",
    });
  });

  it("dedupliziert pro Kanonik (mehrere Aliase = EIN Eintrag)", () => {
    // "steuerberat" matcht Steuerberater UND Steuerberatung (beide →
    // Tax consultant) — es darf nur ein Tax-consultant-Eintrag erscheinen.
    const result = values("steuerberat");
    expect(result.filter((v) => v === "Tax consultant")).toHaveLength(1);
  });

  it("matcht Diakritik- und ß-tolerant", () => {
    expect(values("backerei")).toContain("Bakery");
    expect(values("bäcker")).toContain("Bakery");
    expect(values("waschstrasse")).toContain("Car wash");
  });

  it("jedes Alias-Ziel existiert exakt in GMB_CATEGORIES (Integritaet)", () => {
    for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES.de)) {
      expect(GMB_CATEGORIES, `Alias "${alias}" zeigt auf unbekannte Kategorie`)
        .toContain(canonical);
    }
  });

  it("kein Alias kollidiert mit einem Kanonik-Namen", () => {
    const canonical = new Set(GMB_CATEGORIES.map((c) => c.toLowerCase()));
    for (const alias of Object.keys(CATEGORY_ALIASES.de)) {
      expect(canonical.has(alias.toLowerCase()), `"${alias}" ist schon Kanonik`)
        .toBe(false);
    }
  });
});

describe("isKnownCategory", () => {
  it("erkennt Listen-Eintraege case-insensitiv", () => {
    expect(isKnownCategory("dentist")).toBe(true);
    expect(isKnownCategory("  Law firm ")).toBe(true);
    expect(isKnownCategory("Tax consultant")).toBe(true);
  });

  it("lehnt Freitext, Aliase und Leeres ab (Haekchen nur fuer Kanonik)", () => {
    expect(isKnownCategory("Fahrschulen")).toBe(false);
    expect(isKnownCategory("Zahnarzt")).toBe(false);
    expect(isKnownCategory("")).toBe(false);
  });

  it("erkennt alle Chip-Vorschlaege (Haekchen-Garantie)", async () => {
    const { INDUSTRY_SUGGESTIONS } = await import("./config");
    for (const suggestion of INDUSTRY_SUGGESTIONS) {
      expect(isKnownCategory(suggestion)).toBe(true);
    }
  });
});
