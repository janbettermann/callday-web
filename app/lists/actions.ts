/**
 * Server Actions der Listen-Welt.
 *
 * submitGeneratorFeedback: Feedback zum Listen-Generator ("New"-Feature,
 * Trigger "Tell us how it went" unterm Generator-Titel). Schreibt in
 * beta_feedback — DIESELBE Tabelle wie die App-Feedback-Seite, mit
 * source='web_generator' (Migration 0055 im App-Repo): so schickt der
 * Notify-Trigger (0051) die Mail an Jan und das Admin-Dashboard zeigt
 * alles an einem Ort. Insert ueber den SSR-Client mit anon-Key — die
 * RLS-Policy beta_feedback_insert_self erzwingt user_id = auth.uid(),
 * kein service_role noetig.
 */

"use server";

import { createSupabaseSSR } from "@/lib/supabase-ssr";

export type GeneratorFeedbackCategory = "bug" | "idea";

export interface GeneratorFeedbackResult {
  ok: boolean;
  error?: "unauthorized" | "empty" | "too_long" | "insert_failed";
}

const TEXT_MAX = 2000;

export async function submitGeneratorFeedback(
  category: GeneratorFeedbackCategory,
  rawText: string,
): Promise<GeneratorFeedbackResult> {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return { ok: false, error: "empty" };
  if (text.length > TEXT_MAX) return { ok: false, error: "too_long" };

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    email: user.email ?? null,
    category: category === "bug" ? "bug" : "idea",
    text,
    source: "web_generator",
  });
  if (error) {
    console.error("[lists/feedback] insert failed", error);
    return { ok: false, error: "insert_failed" };
  }
  return { ok: true };
}
