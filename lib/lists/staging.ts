/**
 * Zwischenlager der Nachschlag-Wellen (Tabelle lead_gen_staged_leads,
 * Migration 0057): Leads fertiger Wellen eines laufenden Jobs, bis die
 * letzte Welle durch ist. Liefer-Reihenfolge = (wave, position). Die
 * Rows haengen per Cascade am Job; nach dem Listen-Insert werden sie
 * geloescht.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallableLead } from "./pipeline";

const PAGE = 1000;
const INSERT_CHUNK = 500;

export async function fetchStagedLeads(
  admin: SupabaseClient,
  jobId: string,
): Promise<CallableLead[]> {
  const leads: CallableLead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("lead_gen_staged_leads")
      .select("lead_data")
      .eq("job_id", jobId)
      .order("wave")
      .order("position")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`staged leads fetch failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) leads.push(row.lead_data as CallableLead);
    if (rows.length < PAGE) break;
  }
  return leads;
}

export async function insertStagedLeads(
  admin: SupabaseClient,
  jobId: string,
  wave: number,
  leads: CallableLead[],
): Promise<void> {
  // source_query ist Pipeline-intern — im Lager nur das Lead-Shape.
  const rows = leads.map(({ source_query: _internal, ...lead }, position) => ({
    job_id: jobId,
    wave,
    position,
    lead_data: lead,
  }));
  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK) {
    const { error } = await admin
      .from("lead_gen_staged_leads")
      .insert(rows.slice(offset, offset + INSERT_CHUNK));
    if (error) throw new Error(`staged leads insert failed: ${error.message}`);
  }
}

export async function deleteStagedLeads(
  admin: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await admin
    .from("lead_gen_staged_leads")
    .delete()
    .eq("job_id", jobId);
  if (error) throw new Error(`staged leads delete failed: ${error.message}`);
}
