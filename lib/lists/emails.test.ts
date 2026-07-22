import { describe, expect, it } from "vitest";
import {
  choosePrefillEmail,
  collectEmailCandidates,
  normalizeEmailSource,
} from "./emails";

/**
 * Tests fuer die E-Mail-Auswahl (Spec §13d). Die Beispiel-Adressen
 * stammen aus den echten Testlaeufen (Beauty Salons US 2026-07-14,
 * Asheville-Probe 2026-07-15) — inkl. der Faelle, die die strengen
 * Regeln motiviert haben (regiscorp bei Supercuts, Square-Platzhalter).
 */

describe("normalizeEmailSource", () => {
  it("mappt Kuerzel, Boersen und ai-research aufs Enum", () => {
    expect(normalizeEmailSource("fb")).toBe("facebook");
    expect(normalizeEmailSource("f")).toBe("facebook");
    expect(normalizeEmailSource("Linkedin")).toBe("linkedin");
    expect(normalizeEmailSource("ZInfo")).toBe("directory");
    expect(normalizeEmailSource("appolo")).toBe("directory");
    expect(normalizeEmailSource("ai-research")).toBe("guessed");
    expect(normalizeEmailSource("smtp")).toBe("other");
    expect(normalizeEmailSource(undefined)).toBe("other");
  });

  it("mappt URLs nach Host: eigene Website vs. Social-Profile", () => {
    expect(
      normalizeEmailSource("https://www.ilovewink.com/gift-certificates"),
    ).toBe("website");
    expect(
      normalizeEmailSource("https://www.facebook.com/SalonIntuition/"),
    ).toBe("facebook");
    expect(
      normalizeEmailSource("https://linkedin.com/in/someone"),
    ).toBe("linkedin");
  });
});

describe("collectEmailCandidates", () => {
  it("dedupliziert case-insensitiv, beste Quelle gewinnt", () => {
    const candidates = collectEmailCandidates([
      { email: "Info@Salon.com", source: "ZInfo" },
      { email: "info@salon.com", source: "https://salon.com/contact" },
    ]);
    expect(candidates).toEqual([
      { email: "info@salon.com", source: "website" },
    ]);
  });

  it("verwirft Platzhalter-Domains und kaputte Adressen", () => {
    const candidates = collectEmailCandidates([
      { email: "hi@mystore.com", source: "https://pmu.square.site/x" },
      { email: "kein-at-zeichen", source: "fb" },
      { email: "echt@salon.com", source: "fb" },
    ]);
    expect(candidates.map((c) => c.email)).toEqual(["echt@salon.com"]);
  });

  it("sortiert nach Quellen-Vertrauen (website vor directory)", () => {
    const candidates = collectEmailCandidates([
      { email: "b@corp.com", source: "ZInfo" },
      { email: "a@salon.com", source: "https://salon.com" },
    ]);
    expect(candidates.map((c) => c.source)).toEqual(["website", "directory"]);
  });
});

describe("choosePrefillEmail", () => {
  const salon = { website: "https://salondragonfly.net/", companyName: "Salon Dragonfly" };

  it("Tier 1: Domain-Match mit der Website gewinnt", () => {
    expect(
      choosePrefillEmail(
        [
          { email: "kimhosmer@msn.com", source: "directory" as const },
          { email: "contact@salondragonfly.net", source: "facebook" as const },
        ],
        salon,
      ),
    ).toBe("contact@salondragonfly.net");
  });

  it("Tier 1: Subdomain der Website zaehlt als Match", () => {
    expect(
      choosePrefillEmail(
        [{ email: "hi@foo.com", source: "website" as const }],
        { website: "shop.foo.com", companyName: "Foo" },
      ),
    ).toBe("hi@foo.com");
  });

  it("Tier 2: Freemail mit passendem Namen, Ziffern-Suffix ignoriert", () => {
    expect(
      choosePrefillEmail(
        [
          { email: "terrabeautyparade2003@gmail.com", source: "facebook" as const },
        ],
        { website: "https://beautyparadeasheville.com", companyName: "Beauty Parade" },
      ),
    ).toBe("terrabeautyparade2003@gmail.com");
  });

  it("Fremd-Domain wird nie vorbefuellt — auch als einziger Kandidat", () => {
    expect(
      choosePrefillEmail(
        [{ email: "domainnames@regiscorp.com", source: "website" as const }],
        { website: "https://www.supercuts.com", companyName: "Supercuts" },
      ),
    ).toBeNull();
  });

  it("Freemail ohne Namens-Bezug wird nie vorbefuellt", () => {
    expect(
      choosePrefillEmail(
        [{ email: "hermanshelby377@gmail.com", source: "facebook" as const }],
        { website: null, companyName: "Beauty Parade" },
      ),
    ).toBeNull();
  });

  it("guessed ist von beiden Tiers ausgeschlossen", () => {
    expect(
      choosePrefillEmail(
        [{ email: "info@salondragonfly.net", source: "guessed" as const }],
        salon,
      ),
    ).toBeNull();
  });

  it("ohne Kandidaten oder ohne Match bleibt das Feld leer", () => {
    expect(choosePrefillEmail([], salon)).toBeNull();
  });
});
