import { describe, expect, it } from "vitest";
import { applyEmailEnrichment, enrichmentTargets } from "./enrichment";
import type { CallableLead } from "./pipeline";

function lead(
  name: string,
  website: string | null,
  email: string | null = null,
): CallableLead {
  return {
    company_name: name,
    phone: "+49 221 1",
    email,
    website,
    contact_name: null,
    industry: null,
    location: "Köln",
    custom_fields: {},
  };
}

describe("enrichmentTargets", () => {
  it("nur Leads mit Website und ohne E-Mail, dedupliziert, Reihenfolge stabil", () => {
    const targets = enrichmentTargets([
      lead("A", "https://a.de/"),
      lead("Ohne Website", null),
      lead("Schon angereichert", "https://b.de/", "info@b.de"),
      lead("A Filiale", "https://a.de/"),
      lead("C", "c.de"),
    ]);
    expect(targets).toEqual(["https://a.de/", "c.de"]);
  });
});

describe("applyEmailEnrichment", () => {
  // Shapes aus der Sonde 2026-09-13 (Emails-and-Contacts-Endpunkt).
  const results = [
    {
      query: "https://www.praxis-langenbach.de/",
      emails: [
        { value: "poststelle@ldi.nrw.de", source: "https://www.praxis-langenbach.de/datenschutz/" },
        { value: "termin@praxis-langenbach.de", source: "https://www.praxis-langenbach.de/leistungen/" },
        { value: "info@praxis-langenbach.de", source: "fb" },
      ],
    },
    {
      query: "https://www.alldent-zahnzentrum-koeln.de/",
      emails: [{ value: "koeln@alldent.de", source: "https://www.alldent-zahnzentrum-koeln.de/kontakt/" }],
    },
    { query: "example.com", emails: [] },
  ];

  it("waehlt pro Website hoechstens eine Adresse mit Domain-Match, laesst Fremd-Domains leer", () => {
    const { leads, filled } = applyEmailEnrichment(
      [
        lead("Langenbach", "https://www.praxis-langenbach.de/"),
        lead("AllDent", "https://www.alldent-zahnzentrum-koeln.de/"),
        lead("Beispiel", "example.com"),
        lead("Ohne Website", null),
        lead("Schon da", "https://b.de/", "chef@b.de"),
      ],
      results,
    );
    expect(leads.map((l) => l.email)).toEqual([
      "termin@praxis-langenbach.de", // Website-Quelle vor Facebook-Quelle
      null, // @alldent.de ist nicht die Website-Domain — kein Prefill
      null,
      null,
      "chef@b.de",
    ]);
    expect(filled).toBe(1);
    // Reihenfolge und uebrige Felder unveraendert.
    expect(leads.map((l) => l.company_name)).toEqual([
      "Langenbach",
      "AllDent",
      "Beispiel",
      "Ohne Website",
      "Schon da",
    ]);
  });

  it("ohne passende Antwort bleibt der Lead wie er ist", () => {
    const input = [lead("X", "https://x.de/")];
    const { leads, filled } = applyEmailEnrichment(input, []);
    expect(leads[0]).toBe(input[0]);
    expect(filled).toBe(0);
  });
});
