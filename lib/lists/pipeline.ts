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
      website: (place.website ?? place.site)?.trim() || null,
      contact_name: null,
      industry: place.category?.trim() || fallbackIndustry,
      location: (place.address ?? place.full_address)?.trim() || null,
    });
  }

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
