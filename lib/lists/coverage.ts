/**
 * Coverage-Ledger + Spillover des PLZ-Tilings (Tabellen lead_gen_coverage,
 * lead_gen_spillover — Migration 0056; Spec §14b.1 Punkte 2, 4–6).
 * Reiner Datenzugriff (service_role); die Erschoepfungs-Semantik lebt in
 * tiles.ts, die Verarbeitung in jobs.ts.
 *
 * Kern-Invariante: Coverage wird bei EMPFANG der Ergebnisse geschrieben,
 * nie beim Senden — ein Crash dazwischen laesst Tiles offen, der Folge-
 * Lauf sucht erneut. Fehlerfall kostet Cents, Coverage luegt nie.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallableLead, WebsiteFilterMode } from "./pipeline";
import type { CoverageRowLike } from "./tiles";

const PAGE = 1000;
const DELETE_CHUNK = 200;
const INSERT_CHUNK = 500;

/**
 * Seitenweise lesen — PostgREST kappt bei 1000 Rows pro Request
 * (Supabase-Default), und ein fleissiger Account sammelt ueber viele
 * Staedte mehr Coverage-Rows als das.
 */
async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(`${label} fetch failed: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function fetchCoverage(
  admin: SupabaseClient,
  userId: string,
  categoryCanon: string,
): Promise<CoverageRowLike[]> {
  return fetchAllPages<CoverageRowLike>(
    (from, to) =>
      admin
        .from("lead_gen_coverage")
        .select("tile_id, website_filter, result_count, limit_used")
        .eq("user_id", userId)
        .eq("category_canon", categoryCanon)
        .order("tile_id")
        .range(from, to),
    "lead_gen_coverage",
  );
}

export interface CoverageUpsert {
  user_id: string;
  category_canon: string;
  tile_id: string;
  website_filter: WebsiteFilterMode;
  result_count: number;
  limit_used: number;
  job_id: string;
}

/** Abhaken — Upsert auf (user, canon, tile, filter); queried_at = jetzt. */
export async function upsertCoverage(
  admin: SupabaseClient,
  rows: CoverageUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  const queriedAt = new Date().toISOString();
  const { error } = await admin
    .from("lead_gen_coverage")
    .upsert(
      rows.map((row) => ({ ...row, queried_at: queriedAt })),
      { onConflict: "user_id,category_canon,tile_id,website_filter" },
    );
  if (error) throw new Error(`lead_gen_coverage upsert failed: ${error.message}`);
}

export interface SpilloverRow {
  id: string;
  tile_id: string;
  lead_data: CallableLead;
}

/** Aeltester Spillover zuerst — wer laenger wartet, wird zuerst geliefert. */
export async function fetchSpillover(
  admin: SupabaseClient,
  userId: string,
  categoryCanon: string,
): Promise<SpilloverRow[]> {
  return fetchAllPages<SpilloverRow>(
    (from, to) =>
      admin
        .from("lead_gen_spillover")
        .select("id, tile_id, lead_data")
        .eq("user_id", userId)
        .eq("category_canon", categoryCanon)
        .order("created_at")
        .order("id")
        .range(from, to),
    "lead_gen_spillover",
  );
}

/**
 * Die bei Job-Erstellung fixierte Spillover-Auswahl (params.spillover_ids)
 * in Plan-Reihenfolge — verschwundene Rows (sollte es dank Ein-aktiver-
 * Job-Regel nicht geben) fallen still weg.
 */
export async function fetchSpilloverByIds(
  admin: SupabaseClient,
  ids: string[],
): Promise<SpilloverRow[]> {
  const byId = new Map<string, SpilloverRow>();
  for (let offset = 0; offset < ids.length; offset += DELETE_CHUNK) {
    const { data, error } = await admin
      .from("lead_gen_spillover")
      .select("id, tile_id, lead_data")
      .in("id", ids.slice(offset, offset + DELETE_CHUNK));
    if (error) throw new Error(`lead_gen_spillover fetch failed: ${error.message}`);
    for (const row of (data ?? []) as SpilloverRow[]) byId.set(row.id, row);
  }
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export interface SpilloverInsert {
  user_id: string;
  category_canon: string;
  tile_id: string;
  lead_data: CallableLead;
  job_id: string;
}

export async function insertSpillover(
  admin: SupabaseClient,
  rows: SpilloverInsert[],
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK) {
    const { error } = await admin
      .from("lead_gen_spillover")
      .insert(rows.slice(offset, offset + INSERT_CHUNK));
    if (error) throw new Error(`lead_gen_spillover insert failed: ${error.message}`);
  }
}

export async function deleteSpillover(
  admin: SupabaseClient,
  ids: string[],
): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += DELETE_CHUNK) {
    const { error } = await admin
      .from("lead_gen_spillover")
      .delete()
      .in("id", ids.slice(offset, offset + DELETE_CHUNK));
    if (error) throw new Error(`lead_gen_spillover delete failed: ${error.message}`);
  }
}
