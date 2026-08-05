/**
 * Verarbeitungs-Pipeline: rohe Outscraper-Places → anrufbare Leads →
 * Insert in die bestehende lead_lists/leads-Struktur (identisches Shape
 * wie der App-CSV-Import, damit Mobile-Pull + Stack sich exakt gleich
 * verhalten).
 *
 * "Anrufbar" ist das Produktversprechen des Generators: Telefonnummer
 * vorhanden (leads.phone ist NOT NULL im Schema), Geschaeft operativ,
 * dedupliziert. Ein spaeterer Enricher (z. B. Email via
 * leads_n_contacts) haengt sich als zusaetzliche Stufe zwischen Filter
 * und Insert — deshalb sind die Stufen hier getrennte Funktionen.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { choosePrefillEmail, collectEmailCandidates } from "./emails";
import type { QueryPlanEntry } from "./fanout";
import type { OutscraperPlace } from "./outscraper";

export interface CallableLead {
  company_name: string;
  phone: string;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  industry: string | null;
  location: string | null;
  /** Zusatzdaten aus dem Basis-Response (Rating, Oeffnungszeiten,
   *  Verified) — landen als Custom Fields am Lead, Shape wie beim
   *  CSV-Import (App-Repo types/lead.ts). */
  custom_fields: Record<string, string>;
  /** INTERN: Herkunfts-Query der Zeile (Multi-Location-Interleave).
   *  Wird in buildLeadRows explizit GESTRIPPT — nie in die DB. */
  source_query?: string | null;
}

export type WebsiteFilterMode = "any" | "without" | "with";

export const WEBSITE_FILTER_MODES: WebsiteFilterMode[] = [
  "any",
  "without",
  "with",
];

/**
 * Custom-Field-Definitionen im Shape der App (types/lead-list.ts):
 * enabled === true zeigt das Feld auf der Pre-Call-Card. Nur das
 * Rating kommt auf die Karte (Icebreaker-Wert, eine Zeile) — alles
 * andere bleibt leise verfuegbar, die Karte soll Call ausloesen,
 * nicht Recherche.
 */
const CUSTOM_FIELD_CATALOG = [
  { key: "google_rating", label: "Google rating", enabled: true },
  { key: "opening_hours", label: "Opening hours", enabled: false },
  { key: "google_profile_claimed", label: "Google profile claimed", enabled: false },
];

export interface GeneratedCustomFieldDef {
  key: string;
  label: string;
  order: number;
  enabled: boolean;
  /**
   * Pflicht fuers "Configure lead card"-Sheet der App: es baut sein
   * Spalten-Universum aus schema_field_sources + def.header — Defs ohne
   * header sind dort unsichtbar und wuerden beim Speichern entfernt.
   */
  header: string;
}

/**
 * Quell-Spalten-Mapping fuer das Re-Mapping-Sheet der App
 * (lead_lists.schema_field_sources) — als "Quelle" dienen die
 * Spaltennamen des Generator-Exports (identisch zu XLSX/CSV-Headern).
 * contact_name fehlt bewusst: der Generator liefert ihn nicht,
 * "No source" ist dort die korrekte Anzeige (Feld optional).
 * email kommt seit dem leads_n_contacts-Enrichment mit (§13d).
 */
const GENERATED_SCHEMA_SOURCES: Record<string, string> = {
  company_name: "Company",
  phone: "Phone",
  email: "Email",
  website: "Website",
  industry: "Industry",
  location: "Location",
};

export function buildCustomFieldDefs(
  leads: CallableLead[],
): GeneratedCustomFieldDef[] {
  return CUSTOM_FIELD_CATALOG.filter((def) =>
    leads.some((lead) => def.key in lead.custom_fields),
  ).map((def, index) => ({ ...def, header: def.label, order: index }));
}

function formatRating(place: OutscraperPlace): string | null {
  if (place.rating === undefined || place.rating === null || place.rating === "") {
    return null;
  }
  const reviews = typeof place.reviews === "number" ? place.reviews : null;
  return reviews !== null
    ? `${place.rating} ★ (${reviews} reviews)`
    : `${place.rating} ★`;
}

/**
 * Seit "immer language=en" (2026-08-05, Spec §6b/§14b) liefert Outscraper
 * englische Tages-Schluessel ("Monday") — fuer nicht-englische Maerkte
 * uebersetzen wir sie in die Markt-Sprache. Via Intl statt Hand-Tabellen:
 * deckt alle LANGUAGE_OVERRIDES-Sprachen deterministisch ab. Unbekannte
 * Schluessel (z. B. deutsche Keys aus Alt-Läufen) passieren unveraendert.
 */
const dayMapCache = new Map<string, Record<string, string>>();

function dayNameMap(language: string): Record<string, string> {
  let map = dayMapCache.get(language);
  if (!map) {
    map = {};
    try {
      const format = new Intl.DateTimeFormat(language, {
        weekday: "long",
        timeZone: "UTC",
      });
      const english = new Intl.DateTimeFormat("en", {
        weekday: "long",
        timeZone: "UTC",
      });
      for (let i = 0; i < 7; i++) {
        // 2024-01-01 war ein Montag; UTC haelt den Wochentag stabil.
        const date = new Date(Date.UTC(2024, 0, 1 + i));
        map[english.format(date).toLowerCase()] = format.format(date);
      }
    } catch {
      // Unbekannte Locale → leere Map, Keys passieren unveraendert.
    }
    dayMapCache.set(language, map);
  }
  return map;
}

/** { "Monday": ["08:00-16:00"], ... } → "Montag: 08:00-16:00; ..." */
function formatWorkingHours(
  hours: OutscraperPlace["working_hours"],
  language: string,
): string | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const days = language === "en" ? {} : dayNameMap(language);
  const parts: string[] = [];
  for (const [day, ranges] of Object.entries(hours)) {
    const value = Array.isArray(ranges) ? ranges.join(", ") : String(ranges);
    if (value) parts.push(`${days[day.toLowerCase()] ?? day}: ${value}`);
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

/**
 * Google-Maps-Listings haengen an Website-Links teils percent-encodete
 * Tracking-Querys an (`...%3Futm_source%3Dgoogle...`) — fuer eine
 * Lead-Liste zaehlt die Seite, nicht der Kampagnen-Anhang.
 */
function cleanWebsite(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  let cut = value.length;
  for (const marker of ["?", "%3f", "#"]) {
    const index = lower.indexOf(marker);
    if (index !== -1 && index < cut) cut = index;
  }
  return value.slice(0, cut) || null;
}

function toCustomFields(
  place: OutscraperPlace,
  language: string,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const rating = formatRating(place);
  if (rating) fields.google_rating = rating;
  const hours = formatWorkingHours(place.working_hours, language);
  if (hours) fields.opening_hours = hours;
  if (typeof place.verified === "boolean") {
    fields.google_profile_claimed = place.verified ? "Yes" : "No";
  }
  return fields;
}

/**
 * Mit leads_n_contacts liefert Outscraper EINE ZEILE PRO GEFUNDENER
 * E-MAIL (Zeilen-Explosion, §13c/§13d) — vor allem anderen die Zeilen
 * eines Betriebs wieder zusammenfassen. Basis-Felder sind pro Gruppe
 * identisch (erste Zeile gewinnt), die E-Mails kommen aus allen.
 * Fallback-Schluessel fuer Laeufe ohne place_id: Name + Telefon.
 */
function groupByPlace(places: OutscraperPlace[]): OutscraperPlace[][] {
  const groups = new Map<string, OutscraperPlace[]>();
  for (const place of places) {
    const key =
      place.place_id?.trim() || `${place.name ?? ""}|${place.phone ?? ""}`;
    const group = groups.get(key);
    if (group) {
      group.push(place);
    } else {
      groups.set(key, [place]);
    }
  }
  return [...groups.values()];
}

/**
 * Gruppierung + Filter + Dedupe + Mapping. Dedupe-Schluessel ueber
 * Gruppen hinweg ist die normalisierte Telefonnummer — dieselbe Firma
 * taucht bei Google Maps gern in mehreren Kategorien auf.
 */
export function toCallableLeads(
  places: OutscraperPlace[],
  fallbackIndustry: string | null,
  /** Markt-Sprache des Jobs (countries.ts) — nur fuer die Tages-Namen
   *  der Oeffnungszeiten; "en" = Passthrough. */
  language = "en",
): CallableLead[] {
  const seenPhones = new Set<string>();
  const leads: CallableLead[] = [];

  for (const rows of groupByPlace(places)) {
    const place = rows[0];
    const name = place.name?.trim();
    const phone = place.phone?.trim();
    if (!name || !phone) continue;

    const businessStatus = place.business_status?.toUpperCase();
    if (businessStatus && businessStatus !== "OPERATIONAL") continue;

    const phoneKey = normalizePhoneKey(phone);
    if (!phoneKey || seenPhones.has(phoneKey)) continue;
    seenPhones.add(phoneKey);

    const website = cleanWebsite(place.website ?? place.site);
    leads.push({
      company_name: name,
      phone,
      email: choosePrefillEmail(collectEmailCandidates(rows), {
        website,
        companyName: name,
      }),
      website,
      contact_name: null,
      industry: place.category?.trim() || fallbackIndustry,
      location: (place.address ?? place.full_address)?.trim() || null,
      custom_fields: toCustomFields(place, language),
      source_query: place.query ?? null,
    });
  }

  return leads;
}

/**
 * Website-Filter — der Ziel-Filter fuer die Web-Agentur-Zielgruppe
 * ("Betriebe ohne Website anrufen"). Seit "immer language=en"
 * (2026-08-05) filtert Outscraper das bereits server-seitig (nur
 * Treffer werden geliefert/berechnet) — diese Stufe bleibt als
 * Garantie-Netz: sie prueft dieselbe Bedingung nochmal client-seitig,
 * damit ein stiller Filter-Ausfall bei Outscraper nie eine falsche
 * Liste produziert. (Die alte "Quick-Filter sind UI-only"-Notiz von
 * Mai war ueberholt — filters IST ein API-Param, nur en-gebunden.)
 */
export function filterByWebsite(
  leads: CallableLead[],
  mode: WebsiteFilterMode,
): CallableLead[] {
  if (mode === "without") return leads.filter((lead) => !lead.website);
  if (mode === "with") return leads.filter((lead) => lead.website);
  return leads;
}

/**
 * Stabile Sortierung: Leads, deren Adresse die angefragte Stadt nennt,
 * zuerst. Google mischt bei Text-Suchen ueberregional prominente
 * Treffer ein (live gesehen: Berliner Praxen ganz vorn in einer
 * Koeln-Suche) — die ersten Karten im Stack und die Preview sollen
 * sicher die angefragte Stadt sein. Umland-Treffer bleiben erhalten,
 * rutschen ans Ende. Vor dem Groessen-Cap anwenden, damit City-Treffer
 * beim Kappen garantiert ueberleben.
 */
export function sortByCityMatch(
  leads: CallableLead[],
  city: string | null,
): CallableLead[] {
  if (!city) return leads;
  const needle = city.toLowerCase();
  const cityHits: CallableLead[] = [];
  const rest: CallableLead[] = [];
  for (const lead of leads) {
    (lead.location?.toLowerCase().includes(needle) ? cityHits : rest).push(
      lead,
    );
  }
  return [...cityHits, ...rest];
}

/** Telefon-Schluessel wie im Dedupe: nur Ziffern. */
export function normalizePhoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Leads rauswerfen, die der Account schon besitzt (Telefon-Abgleich
 * gegen alle bestehenden Listen) — niemand bezahlt Credits fuer
 * Dubletten seiner eigenen Listen. Vorstufe des Coverage-Ledgers
 * (§14b.1); dieser Filter bleibt auch danach als Garantie-Netz.
 */
export function filterKnownPhones(
  leads: CallableLead[],
  knownPhoneKeys: Set<string>,
): CallableLead[] {
  if (knownPhoneKeys.size === 0) return leads;
  return leads.filter(
    (lead) => !knownPhoneKeys.has(normalizePhoneKey(lead.phone)),
  );
}

/**
 * Liefer-Reihenfolge fuer Multi-Location (Generator-v3 §14b.1):
 * Zwei-Ebenen-Round-Robin — gleichmaessig ueber die Location-Chips,
 * innerhalb eines State-Chips gleichmaessig ueber dessen Stadt-Queries,
 * jede Query-Gruppe city-first sortiert. Damit frisst eine Grossstadt
 * beim Max-Size-Cap nie die ganze Liste. Ein Plan mit <= 1 Eintrag
 * verhaelt sich exakt wie der alte Ein-Stadt-Sort.
 */
export function orderForDelivery(
  leads: CallableLead[],
  plan: QueryPlanEntry[] | undefined,
  fallbackCity: string | null,
): CallableLead[] {
  if (!plan || plan.length <= 1) {
    return sortByCityMatch(leads, plan?.[0]?.city ?? fallbackCity);
  }

  const byQuery = new Map<string, CallableLead[]>(
    plan.map((entry) => [entry.query, []]),
  );
  // Zeilen ohne Plan-Zuordnung (defensiv — sollte nicht vorkommen)
  // haengen hinten an statt zu verschwinden.
  const stray: CallableLead[] = [];
  for (const lead of leads) {
    const group = lead.source_query
      ? byQuery.get(lead.source_query)
      : undefined;
    if (group) group.push(lead);
    else stray.push(lead);
  }

  const groupsByLocation = new Map<string, CallableLead[][]>();
  for (const entry of plan) {
    const sorted = sortByCityMatch(byQuery.get(entry.query) ?? [], entry.city);
    const groups = groupsByLocation.get(entry.location) ?? [];
    groups.push(sorted);
    groupsByLocation.set(entry.location, groups);
  }

  const roundRobin = (streams: CallableLead[][]): CallableLead[] => {
    const merged: CallableLead[] = [];
    for (let i = 0, added = true; added; i++) {
      added = false;
      for (const stream of streams) {
        if (i < stream.length) {
          merged.push(stream[i]);
          added = true;
        }
      }
    }
    return merged;
  };

  const perLocation = [...groupsByLocation.values()].map(roundRobin);
  return [...roundRobin(perLocation), ...stray];
}

const LEADS_INSERT_CHUNK = 500;

interface InsertListOptions {
  userId: string;
  name: string;
  leads: CallableLead[];
  customFieldDefs: GeneratedCustomFieldDef[];
}

/**
 * Reine Row-Builder — getrennt vom Insert, damit der Shape-Contract-
 * Test (app-shape-contract.test.ts) die exakten Payloads gegen das
 * Import-Shape der App validieren kann, ohne eine DB zu brauchen.
 */
export function buildListRow(
  listId: string,
  options: InsertListOptions,
): Record<string, unknown> {
  const total = options.leads.length;
  return {
    id: listId,
    user_id: options.userId,
    name: options.name,
    total_leads: total,
    batch_size: total,
    current_batch: 1,
    total_batches: 1,
    status: "active",
    is_sample: false,
    custom_field_defs: options.customFieldDefs,
    schema_field_sources: GENERATED_SCHEMA_SOURCES,
  };
}

export function buildLeadRows(
  listId: string,
  options: InsertListOptions,
): Array<Record<string, unknown>> {
  // source_query ist Pipeline-intern (Interleave) — die leads-Tabelle
  // kennt die Spalte nicht, spreaden wuerde den Insert brechen.
  return options.leads.map(({ source_query: _internal, ...lead }, index) => ({
    id: randomUUID(),
    list_id: listId,
    user_id: options.userId,
    batch_number: 1,
    position_in_batch: index,
    ...lead,
  }));
}

/**
 * Legt lead_lists-Row + leads-Rows an (service_role, auf den User
 * gescoped). Batch-Spalten wie beim App-Import: eine Liste = ein Pool,
 * position_in_batch traegt die Reihenfolge.
 */
export async function insertGeneratedList(
  admin: SupabaseClient,
  options: InsertListOptions,
): Promise<string> {
  const listId = randomUUID();

  const { error: listError } = await admin
    .from("lead_lists")
    .insert(buildListRow(listId, options));
  if (listError) {
    throw new Error(`lead_lists insert failed: ${listError.message}`);
  }

  const rows = buildLeadRows(listId, options);

  for (let offset = 0; offset < rows.length; offset += LEADS_INSERT_CHUNK) {
    const { error } = await admin
      .from("leads")
      .insert(rows.slice(offset, offset + LEADS_INSERT_CHUNK));
    if (error) {
      // Halbe Liste waere schlimmer als keine — aufraeumen, dann werfen.
      await admin.from("leads").delete().eq("list_id", listId);
      await admin.from("lead_lists").delete().eq("id", listId);
      throw new Error(`leads insert failed: ${error.message}`);
    }
  }

  return listId;
}
