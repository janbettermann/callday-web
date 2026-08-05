/**
 * Credit-Konto des Listen-Generators (Tabelle lead_credits, Migration
 * 0052) — Phase 1 des Credit-Modells (Generator-v3 §14b Punkt 4).
 *
 * Ledger-Prinzip: Kontostand = SUM(delta) pro User. Alle Schreibpfade
 * sind idempotent (partial unique indexes: ein signup_grant pro User,
 * eine list_delivery pro Job) — doppelte Aufrufe sind harmlos.
 * Race-Sicherheit kommt aus der Ein-aktiver-Job-Regel (unique index
 * auf lead_gen_jobs): zwischen Balance-Check und Abrechnung kann kein
 * zweiter Job desselben Users laufen.
 *
 * Phase 2 (mit IAP/RevenueCat): sub_grant 500/Monat-Drip (auch Jahres-
 * Abo, auch im Trial), Stacking-Cap 1500, sub_expiry_wipe am Perioden-
 * Ende — Entscheidungen Jan 2026-08-05, Spec §10/§14b.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Kostenlose Lead-Credits pro Account (einmalig, bei Registrierung). */
export const SIGNUP_CREDITS = 250;

/**
 * Obergrenze pro einzelner Liste — entspricht der realistischen
 * Liefer-Tiefe einer Einzel-Query (Scan-Cap 500); faellt, sobald
 * Multi-Location-Fan-out mehr hergibt.
 */
export const MAX_LIST_SIZE = 500;

/** Vorbelegung des Max-list-size-Felds (das alte 250er-Versprechen). */
export const DEFAULT_LIST_SIZE = 250;

/**
 * Gewuenschte Listengroesse gegen Kontostand + Hard-Cap klammern.
 * null = keine Credits mehr (Aufrufer lehnt ab). Fehlende/kaputte
 * Eingabe faellt auf den Default zurueck — die UI schickt Zahlen,
 * alles andere ist Handarbeit am Endpoint.
 */
export function clampRequestedSize(
  requested: unknown,
  balance: number,
): number | null {
  const cap = Math.min(MAX_LIST_SIZE, balance);
  if (cap < 1) return null;
  const size =
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.floor(requested)
      : DEFAULT_LIST_SIZE;
  return Math.max(1, Math.min(size, cap));
}

/**
 * Gespeicherte max_size eines Jobs defensiv lesen (jsonb) — alte Jobs
 * ohne das Feld liefern den Default.
 */
export function resolveStoredMaxSize(value: unknown): number {
  const size =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_LIST_SIZE;
  return Math.max(1, Math.min(size, MAX_LIST_SIZE));
}

/**
 * Signup-Grant lazy anlegen — beim ersten Kontakt mit dem Generator
 * (Status-Poll oder Generate). Idempotent via partial unique index;
 * der 23505-Konflikt ist der Normalfall ab dem zweiten Aufruf.
 */
export async function ensureSignupGrant(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.from("lead_credits").insert({
    user_id: userId,
    delta: SIGNUP_CREDITS,
    reason: "signup_grant",
  });
  if (error && error.code !== "23505") {
    throw new Error(`signup grant failed: ${error.message}`);
  }
}

/** Kontostand = Summe aller Ledger-Eintraege des Users. */
export async function getCreditBalance(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("lead_credits")
    .select("delta")
    .eq("user_id", userId);
  if (error) throw new Error(`credit balance failed: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + (row.delta ?? 0), 0);
}

/** Verbraucht / Gesamt / Kontostand — Basis fuer Ring + Balken. */
export interface CreditSummary {
  /** Bisher verbrauchte Credits (total - balance). */
  used: number;
  /** Alle bisher vergebenen Credits (Summe der positiven Deltas). */
  total: number;
  /** Aktueller Kontostand (Summe aller Deltas). */
  balance: number;
}

/**
 * Zusammenfassung fuer die Anzeige (Ring/Balken): Fuellung = used/total
 * (0 verbraucht → leer, alles verbraucht → voll). used = total (alles
 * Vergebene) minus balance (was noch da ist). Hat ein User noch keinen
 * Ledger-Eintrag (Signup-Grant kommt erst beim ersten Generator-Kontakt),
 * zeigen wir den Start-Zustand — ohne hier einen Grant zu schreiben
 * (GET bleibt seiteneffektfrei).
 */
export async function getCreditSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<CreditSummary> {
  const { data, error } = await admin
    .from("lead_credits")
    .select("delta")
    .eq("user_id", userId);
  if (error) throw new Error(`credit summary failed: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) {
    return { used: 0, total: SIGNUP_CREDITS, balance: SIGNUP_CREDITS };
  }
  const balance = rows.reduce((sum, row) => sum + (row.delta ?? 0), 0);
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.delta ?? 0), 0);
  return { used: Math.max(0, total - balance), total, balance };
}

/**
 * Gelieferte Leads eines ready-Jobs abrechnen. Idempotent (eine
 * Abrechnung pro Job); delta=0 wird nie geschrieben (CHECK-Constraint —
 * und eine leere Liste failt der Job ohnehin vorher).
 */
export async function chargeJobDelivery(
  admin: SupabaseClient,
  input: { userId: string; jobId: string; deliveredCount: number },
): Promise<void> {
  if (input.deliveredCount < 1) return;
  const { error } = await admin.from("lead_credits").insert({
    user_id: input.userId,
    delta: -input.deliveredCount,
    reason: "list_delivery",
    job_id: input.jobId,
  });
  if (error && error.code !== "23505") {
    throw new Error(`credit charge failed: ${error.message}`);
  }
}
