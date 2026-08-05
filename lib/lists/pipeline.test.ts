import { describe, expect, it } from "vitest";
import type { OutscraperPlace } from "./outscraper";
import {
  buildCustomFieldDefs,
  buildLeadRows,
  filterByWebsite,
  filterKnownPhones,
  orderForDelivery,
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

  it("uebersetzt englische Tages-Schluessel in die Markt-Sprache", () => {
    // Seit "immer language=en" liefert Outscraper Monday/Tuesday/… —
    // fuer de-Maerkte werden sie zu Montag/Dienstag, Zeiten unveraendert.
    const [de] = toCallableLeads(
      [
        place({
          working_hours: { Monday: ["08:00-16:00"], Sunday: ["Closed"] },
        }),
      ],
      null,
      "de",
    );
    expect(de.custom_fields.opening_hours).toBe(
      "Montag: 08:00-16:00; Sonntag: Closed",
    );

    // Unbekannte Keys (Alt-Daten mit deutschen Keys) passieren unveraendert.
    const [passthrough] = toCallableLeads(
      [place({ working_hours: { Montag: ["08:00-16:00"] } })],
      null,
      "de",
    );
    expect(passthrough.custom_fields.opening_hours).toBe("Montag: 08:00-16:00");

    // en = reines Passthrough, fr via Intl.
    const [fr] = toCallableLeads(
      [place({ working_hours: { Monday: ["09:00-17:00"] } })],
      null,
      "fr",
    );
    expect(fr.custom_fields.opening_hours).toBe("lundi: 09:00-17:00");
  });
});

describe("filterKnownPhones (Bestands-Dedupe)", () => {
  it("wirft Leads raus, deren Nummer der Account schon besitzt", () => {
    const result = filterKnownPhones(
      [
        lead({ company_name: "Neu", phone: "+49 221 111111" }),
        lead({ company_name: "Bekannt", phone: "+49 (221) 22 22 22" }),
      ],
      new Set(["49221222222"]),
    );
    expect(result.map((l) => l.company_name)).toEqual(["Neu"]);
  });

  it("leere Bestandsmenge laesst alles durch", () => {
    const input = [lead({})];
    expect(filterKnownPhones(input, new Set())).toBe(input);
  });
});

describe("orderForDelivery (Multi-Location-Interleave)", () => {
  const plan = [
    { query: "Dentist, Köln", city: "Köln", location: "Köln" },
    { query: "Dentist, München, Bayern", city: "München", location: "Bayern" },
    { query: "Dentist, Nürnberg, Bayern", city: "Nürnberg", location: "Bayern" },
  ];
  const mk = (name: string, query: string, location: string) =>
    lead({
      company_name: name,
      phone: `+49 ${name.length} ${Math.abs(hash(name))}`,
      location,
      source_query: query,
    });
  // simpler deterministischer "Hash" fuer eindeutige Test-Telefonnummern
  const hash = (s: string) =>
    [...s].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) % 100000;

  it("interleavt fair ueber Locations, nicht ueber Queries", () => {
    // Bayern hat ZWEI Queries — darf trotzdem nur jeden zweiten Slot
    // bekommen (Fairness pro Chip, nicht pro Query).
    const leads = [
      mk("K1", plan[0].query, "Köln"),
      mk("K2", plan[0].query, "Köln"),
      mk("M1", plan[1].query, "München"),
      mk("M2", plan[1].query, "München"),
      mk("N1", plan[2].query, "Nürnberg"),
    ];
    const ordered = orderForDelivery(leads, plan, null).map(
      (l) => l.company_name,
    );
    expect(ordered.slice(0, 2).sort()).toEqual(["K1", "M1"]);
    expect(ordered).toHaveLength(5);
    // Koeln bekommt Slot 1+3 (2 von den ersten 4), Bayern die anderen.
    expect(ordered.filter((n) => n.startsWith("K")).length).toBe(2);
  });

  it("sortiert innerhalb einer Query-Gruppe city-first", () => {
    const leads = [
      mk("Umland", plan[0].query, "Pulheim"),
      mk("Stadt", plan[0].query, "Köln-Ehrenfeld"),
    ];
    const ordered = orderForDelivery(leads, [plan[0]], null);
    expect(ordered[0].company_name).toBe("Stadt");
  });

  it("verhaelt sich ohne Plan wie der alte Ein-Stadt-Sort", () => {
    const leads = [
      mk("Umland", "x", "Pulheim"),
      mk("Stadt", "x", "Köln"),
    ];
    const ordered = orderForDelivery(leads, undefined, "Köln");
    expect(ordered[0].company_name).toBe("Stadt");
  });

  it("haengt Zeilen ohne Plan-Zuordnung hinten an statt sie zu verlieren", () => {
    const leads = [
      mk("Fremd", "Dentist, Unbekannt", "Woanders"),
      mk("K1", plan[0].query, "Köln"),
    ];
    const ordered = orderForDelivery(leads, plan, null).map(
      (l) => l.company_name,
    );
    expect(ordered).toEqual(["K1", "Fremd"]);
  });
});

describe("buildLeadRows", () => {
  it("strippt das interne source_query — nie in die DB-Row", () => {
    const rows = buildLeadRows("list-1", {
      userId: "user-1",
      name: "Test",
      leads: [lead({ source_query: "Dentist, Köln" })],
      customFieldDefs: [],
    });
    expect(rows[0]).not.toHaveProperty("source_query");
    expect(rows[0]).toMatchObject({ list_id: "list-1", position_in_batch: 0 });
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
