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
}

export function buildCustomFieldDefs(
  leads: CallableLead[],
): GeneratedCustomFieldDef[] {
  return CUSTOM_FIELD_CATALOG.filter((def) =>
    leads.some((lead) => def.key in lead.custom_fields),
  ).map((def, index) => ({ ...def, order: index }));
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

/** { "Montag": ["08:00-16:00"], ... } → "Montag: 08:00-16:00; ..." */
function formatWorkingHours(
  hours: OutscraperPlace["working_hours"],
): string | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const parts: string[] = [];
  for (const [day, ranges] of Object.entries(hours)) {
    const value = Array.isArray(ranges) ? ranges.join(", ") : String(ranges);
    if (value) parts.push(`${day}: ${value}`);
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

function toCustomFields(place: OutscraperPlace): Record<string, string> {
  const fields: Record<string, string> = {};
  const rating = formatRating(place);
  if (rating) fields.google_rating = rating;
  const hours = formatWorkingHours(place.working_hours);
  if (hours) fields.opening_hours = hours;
  if (typeof place.verified === "boolean") {
    fields.google_profile_claimed = place.verified ? "Yes" : "No";
  }
  return fields;
}

/**
 * Filter + Dedupe + Mapping. Dedupe-Schluessel ist die normalisierte
 * Telefonnummer — dieselbe Firma taucht bei Google Maps gern in
 * mehreren Kategorien auf.
 */
export function toCallableLeads(
  places: OutscraperPlace[],
  fallbackIndustry: string | null,
): CallableLead[] {
  const seenPhones = new Set<string>();
  const leads: CallableLead[] = [];

  for (const place of places) {
    const name = place.name?.trim();
    const phone = place.phone?.trim();
    if (!name || !phone) continue;

    const businessStatus = place.business_status?.toUpperCase();
    if (businessStatus && businessStatus !== "OPERATIONAL") continue;

    const phoneKey = phone.replace(/\D/g, "");
    if (!phoneKey || seenPhones.has(phoneKey)) continue;
    seenPhones.add(phoneKey);

    leads.push({
      company_name: name,
      phone,
      email: null,
      website: cleanWebsite(place.website ?? place.site),
      contact_name: null,
      industry: place.category?.trim() || fallbackIndustry,
      location: (place.address ?? place.full_address)?.trim() || null,
      custom_fields: toCustomFields(place),
    });
  }

  return leads;
}

/**
 * Website-Filter — der Ziel-Filter fuer die Web-Agentur-Zielgruppe
 * ("Betriebe ohne Website anrufen"). Outscrapers Quick-Filter sind
 * UI-only (API unterstuetzt sie nicht, Staff-bestaetigt), deshalb
 * filtert diese Stufe client-seitig; das website-Feld kommt im
 * Basis-Preis mit.
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

const LEADS_INSERT_CHUNK = 500;

interface InsertListOptions {
  userId: string;
  name: string;
  leads: CallableLead[];
  customFieldDefs: GeneratedCustomFieldDef[];
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
  const total = options.leads.length;

  const { error: listError } = await admin.from("lead_lists").insert({
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
  });
  if (listError) {
    throw new Error(`lead_lists insert failed: ${listError.message}`);
  }

  const rows = options.leads.map((lead, index) => ({
    id: randomUUID(),
    list_id: listId,
    user_id: options.userId,
    batch_number: 1,
    position_in_batch: index,
    ...lead,
  }));

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
