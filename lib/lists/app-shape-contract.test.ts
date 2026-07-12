import { describe, expect, it } from "vitest";
import {
  buildCustomFieldDefs,
  buildLeadRows,
  buildListRow,
  toCallableLeads,
} from "./pipeline";

/**
 * SHAPE-CONTRACT-TEST — der ausfuehrbare Vertrag mit der Mobile-App.
 *
 * Generierte Listen muessen exakt so aussehen wie CSV-Importe der App,
 * sonst brechen App-Features leise (Pull, Karten-Stack, "Configure
 * lead card"). Der Vertrag lebt in ZWEI Repos ohne geteilten Typ —
 * dieser Test pinnt die Web-Seite auf den Stand der App-Erwartungen.
 *
 * App-seitige Quellen des Vertrags (dealswipe-app):
 *   - types/lead-list.ts        → CustomFieldDef (key/label/order/
 *     enabled/header) + schema_field_sources (Partial<Record<
 *     LeadListSchemaField, string>>)
 *   - hooks/useImportStore.ts   → hydrateForEdit baut das Mapping-Sheet
 *     aus schema_field_sources + def.header; Defs OHNE header sind dort
 *     unsichtbar und werden beim Speichern ENTFERNT
 *   - utils/import/persist.ts   → Batch-Defaults des Imports
 *   - utils/sync/pull-from-cloud.ts → erwartete Spalten beim Pull
 *
 * Wenn dieser Test bricht: nicht einfach anpassen — pruefen, ob die
 * App-Seite mitgezogen werden muss (oder umgekehrt).
 */

const APP_SCHEMA_FIELDS = [
  "company_name",
  "phone",
  "email",
  "website",
  "contact_name",
  "industry",
  "location",
] as const;

function buildFixtureOptions() {
  const leads = toCallableLeads(
    [
      {
        name: "Zahnärzte Müller",
        phone: "+49 221 111111",
        website: "https://mueller.de",
        address: "Hauptstraße 1, 50667 Köln",
        category: "Zahnarzt",
        business_status: "OPERATIONAL",
        rating: 4.8,
        reviews: 120,
        verified: true,
        working_hours: { Montag: ["08:00-16:00"] },
      },
      {
        name: "Praxis ohne Extras",
        phone: "+49 221 222222",
        business_status: "OPERATIONAL",
      },
    ],
    "Dentists",
  );
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    name: "Dentists – Köln",
    leads,
    customFieldDefs: buildCustomFieldDefs(leads),
  };
}

describe("lead_lists-Row (Import-Shape der App)", () => {
  const row = buildListRow("11111111-1111-1111-1111-111111111111", buildFixtureOptions());

  it("traegt die Batch-Defaults des App-Imports (eine Liste = ein Pool)", () => {
    expect(row.total_leads).toBe(2);
    expect(row.batch_size).toBe(2);
    expect(row.current_batch).toBe(1);
    expect(row.total_batches).toBe(1);
    expect(row.status).toBe("active");
    expect(row.is_sample).toBe(false);
  });

  it("mappt schema_field_sources nur auf gueltige Schema-Felder, Pflichtfelder gesetzt", () => {
    const sources = row.schema_field_sources as Record<string, string>;
    for (const key of Object.keys(sources)) {
      expect(APP_SCHEMA_FIELDS).toContain(key);
      expect(typeof sources[key]).toBe("string");
      expect(sources[key].length).toBeGreaterThan(0);
    }
    // Ohne diese beiden blockiert das "Configure lead card"-Sheet den Save.
    expect(sources.company_name).toBeTruthy();
    expect(sources.phone).toBeTruthy();
  });

  it("gibt jeder Custom-Field-Definition das volle App-Shape inkl. header", () => {
    const defs = row.custom_field_defs as Array<Record<string, unknown>>;
    expect(defs.length).toBeGreaterThan(0);
    defs.forEach((def, index) => {
      expect(typeof def.key).toBe("string");
      expect(typeof def.label).toBe("string");
      // Ohne header entfernt das Mapping-Sheet die Def beim Speichern.
      expect(typeof def.header).toBe("string");
      expect((def.header as string).length).toBeGreaterThan(0);
      expect(def.order).toBe(index);
      expect(typeof def.enabled).toBe("boolean");
    });
  });
});

describe("leads-Rows (Import-Shape der App)", () => {
  const options = buildFixtureOptions();
  const rows = buildLeadRows("11111111-1111-1111-1111-111111111111", options);

  it("nummeriert position_in_batch sequentiell ab 0, batch_number = 1", () => {
    rows.forEach((row, index) => {
      expect(row.batch_number).toBe(1);
      expect(row.position_in_batch).toBe(index);
    });
  });

  it("erfuellt die NOT-NULL-Pflichten (phone, company_name) und scoped auf den User", () => {
    for (const row of rows) {
      expect(typeof row.company_name).toBe("string");
      expect((row.company_name as string).length).toBeGreaterThan(0);
      expect(typeof row.phone).toBe("string");
      expect((row.phone as string).length).toBeGreaterThan(0);
      expect(row.user_id).toBe(options.userId);
      expect(row.list_id).toBe("11111111-1111-1111-1111-111111111111");
    }
  });

  it("haelt custom_fields-Keys deckungsgleich mit den Defs der Liste", () => {
    const defKeys = new Set(options.customFieldDefs.map((d) => d.key));
    for (const row of rows) {
      const fields = row.custom_fields as Record<string, string>;
      for (const key of Object.keys(fields)) {
        expect(defKeys.has(key)).toBe(true);
      }
    }
  });
});
