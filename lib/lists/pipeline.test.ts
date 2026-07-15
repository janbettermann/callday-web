import { describe, expect, it } from "vitest";
import type { OutscraperPlace } from "./outscraper";
import {
  buildCustomFieldDefs,
  filterByWebsite,
  sortByCityMatch,
  toCallableLeads,
  type CallableLead,
} from "./pipeline";

/**
 * Tests fuer die puren Pipeline-Stufen — das Callable-Versprechen
 * (Telefon, operational, Dedupe) und die Anreicherungs-Formate.
 */

function place(overrides: Partial<OutscraperPlace>): OutscraperPlace {
  return {
    name: "Testbetrieb",
    phone: "+49 221 123456",
    business_status: "OPERATIONAL",
    ...overrides,
  };
}

function lead(overrides: Partial<CallableLead>): CallableLead {
  return {
    company_name: "Testbetrieb",
    phone: "+49 221 123456",
    email: null,
    website: null,
    contact_name: null,
    industry: null,
    location: null,
    custom_fields: {},
    ...overrides,
  };
}

describe("toCallableLeads", () => {
  it("verwirft Eintraege ohne Telefonnummer oder Namen", () => {
    const leads = toCallableLeads(
      [
        place({ name: "Mit Telefon" }),
        place({ name: "Ohne Telefon", phone: undefined }),
        place({ name: "Leeres Telefon", phone: "  " }),
        place({ name: undefined }),
      ],
      null,
    );
    expect(leads.map((l) => l.company_name)).toEqual(["Mit Telefon"]);
  });

  it("verwirft dauerhaft geschlossene Betriebe, behaelt Eintraege ohne Status", () => {
    const leads = toCallableLeads(
      [
        place({ name: "Offen", phone: "+49 1", business_status: "OPERATIONAL" }),
        place({ name: "Zu", phone: "+49 2", business_status: "CLOSED_PERMANENTLY" }),
        place({ name: "Ohne Status", phone: "+49 3", business_status: undefined }),
      ],
      null,
    );
    expect(leads.map((l) => l.company_name)).toEqual(["Offen", "Ohne Status"]);
  });

  it("dedupliziert ueber die normalisierte Telefonnummer", () => {
    const leads = toCallableLeads(
      [
        place({ name: "Erster", phone: "+49 221 123456" }),
        place({ name: "Dublette", phone: "+49 (221) 12 34 56" }),
        place({ name: "Andere Nummer", phone: "+49 221 999999" }),
      ],
      null,
    );
    expect(leads.map((l) => l.company_name)).toEqual([
      "Erster",
      "Andere Nummer",
    ]);
  });

  it("faltet Enrichment-Zeilen (eine pro E-Mail) auf einen Lead zusammen", () => {
    const winkRow = {
      place_id: "wink-1",
      website: "https://www.ilovewink.com/",
    };
    const leads = toCallableLeads(
      [
        place({
          ...winkRow,
          email: "shop@ilovewink.com",
          source: "https://www.ilovewink.com/gift-certificates",
        }),
        place({ ...winkRow, email: "chrissyd@ilovewink.com", source: "fb" }),
        place({ name: "Ohne Mails", phone: "+1 828 2", place_id: "other-1" }),
      ],
      null,
    );
    expect(leads).toHaveLength(2);
    // Beide Adressen matchen die Domain — die Website-Quelle gewinnt.
    expect(leads[0].email).toBe("shop@ilovewink.com");
    expect(leads[1].email).toBeNull();
  });

  it("vorbefuellt keine Fremd-Domain-Adresse (Ketten-Fall)", () => {
    const leads = toCallableLeads(
      [
        place({
          place_id: "sc-1",
          website: "https://www.supercuts.com/x",
          email: "domainnames@regiscorp.com",
          source: "https://www.supercuts.com/contact",
        }),
      ],
      null,
    );
    expect(leads[0].email).toBeNull();
  });

  it("schneidet Tracking-Anhaenge von Website-URLs ab (roh und percent-encoded)", () => {
    const leads = toCallableLeads(
      [
        place({ name: "A", phone: "+1 1", website: "https://a.de/?utm_source=google" }),
        place({ name: "B", phone: "+1 2", website: "https://b.de/seite%3Futm_source%3Dgoogle" }),
        place({ name: "C", phone: "+1 3", website: "https://c.de/pfad#anker" }),
      ],
      null,
    );
    expect(leads.map((l) => l.website)).toEqual([
      "https://a.de/",
      "https://b.de/seite",
      "https://c.de/pfad",
    ]);
  });

  it("faellt bei fehlender Kategorie auf die angefragte Branche zurueck", () => {
    const leads = toCallableLeads(
      [place({ category: "Zahnarzt" }), place({ phone: "+1 5", category: undefined })],
      "Dentists",
    );
    expect(leads.map((l) => l.industry)).toEqual(["Zahnarzt", "Dentists"]);
  });

  it("formatiert Rating, Oeffnungszeiten und Verified als Custom Fields", () => {
    const [withAll, ratingOnly, bare] = toCallableLeads(
      [
        place({
          rating: 4.7,
          reviews: 212,
          verified: true,
          working_hours: { Montag: ["08:00-16:00"], Samstag: ["Geschlossen"] },
        }),
        place({ phone: "+1 6", rating: 5, verified: false }),
        place({ phone: "+1 7" }),
      ],
      null,
    );
    expect(withAll.custom_fields).toEqual({
      google_rating: "4.7 ★ (212 reviews)",
      opening_hours: "Montag: 08:00-16:00; Samstag: Geschlossen",
      google_profile_claimed: "Yes",
    });
    expect(ratingOnly.custom_fields).toEqual({
      google_rating: "5 ★",
      google_profile_claimed: "No",
    });
    expect(bare.custom_fields).toEqual({});
  });
});

describe("filterByWebsite", () => {
  const mixed = [
    lead({ company_name: "Mit Website", website: "https://a.de" }),
    lead({ company_name: "Ohne Website" }),
  ];

  it("without behaelt nur Leads ohne Website", () => {
    expect(
      filterByWebsite(mixed, "without").map((l) => l.company_name),
    ).toEqual(["Ohne Website"]);
  });

  it("with behaelt nur Leads mit Website", () => {
    expect(filterByWebsite(mixed, "with").map((l) => l.company_name)).toEqual([
      "Mit Website",
    ]);
  });

  it("any laesst alles durch", () => {
    expect(filterByWebsite(mixed, "any")).toHaveLength(2);
  });
});

describe("sortByCityMatch", () => {
  it("zieht Stadt-Treffer stabil nach vorn (case-insensitiv)", () => {
    const sorted = sortByCityMatch(
      [
        lead({ company_name: "Berlin", location: "Hauptstr. 1, Berlin" }),
        lead({ company_name: "Koeln 1", location: "Ring 1, 50667 Köln" }),
        lead({ company_name: "Umland", location: "Weg 2, Hürth" }),
        lead({ company_name: "Koeln 2", location: "Dom 3, KÖLN" }),
        lead({ company_name: "Ohne Ort" }),
      ],
      "Köln",
    );
    expect(sorted.map((l) => l.company_name)).toEqual([
      "Koeln 1",
      "Koeln 2",
      "Berlin",
      "Umland",
      "Ohne Ort",
    ]);
  });

  it("laesst die Reihenfolge ohne Stadt unveraendert", () => {
    const input = [lead({ company_name: "A" }), lead({ company_name: "B" })];
    expect(sortByCityMatch(input, null)).toEqual(input);
  });
});

describe("buildCustomFieldDefs", () => {
  it("nimmt nur Felder auf, die mindestens ein Lead traegt — mit header = label", () => {
    const defs = buildCustomFieldDefs([
      lead({ custom_fields: { google_rating: "5 ★" } }),
      lead({ custom_fields: { opening_hours: "Montag: 08:00" } }),
    ]);
    expect(defs).toEqual([
      {
        key: "google_rating",
        label: "Google rating",
        header: "Google rating",
        order: 0,
        enabled: true,
      },
      {
        key: "opening_hours",
        label: "Opening hours",
        header: "Opening hours",
        order: 1,
        enabled: false,
      },
    ]);
  });

  it("liefert ein leeres Array, wenn keine Custom-Daten vorhanden sind", () => {
    expect(buildCustomFieldDefs([lead({})])).toEqual([]);
  });
});
