#!/usr/bin/env tsx
/**
 * Phase 4 Launch-Day-Script.
 *
 * Generiert pro eligible Application einen Stripe Promotion-Code (zum
 * "founder-50-forever"-Coupon, max_redemptions: 1) und verschickt die
 * FounderCodeAtLaunch-Email via Resend.
 *
 * Eligible = applications mit status IN ('approved','launch_list',
 * 'active_beta') AND founder_code IS NULL. Re-Run ist idempotent —
 * vorhandene founder_codes werden nicht ueberschrieben, vorhandene
 * email_logs werden nicht doppelt verschickt.
 *
 * CLI:
 *   tsx scripts/launch-send-codes.ts --dry-run
 *     → Zeigt was passieren wuerde, schreibt nichts.
 *
 *   tsx scripts/launch-send-codes.ts --only=email1@x.com,email2@y.com
 *     → Nur diese Adressen prozessieren (fuer Test-Sends an dich selbst).
 *
 *   tsx scripts/launch-send-codes.ts
 *     → Live-Modus. Confirm-Prompt ("type 'send' to proceed") vor
 *       jeglicher Schreib-Operation, schuetzt vor versehentlichem Launch.
 *
 * Stripe-Mode wird automatisch aus STRIPE_SECRET_KEY abgeleitet
 * (sk_test_* vs sk_live_*) und im Header geloggt — beim Re-Run ein
 * Augenmerk drauf, dass der erwartete Mode aktiv ist.
 *
 * Env-Vars (aus .env.local geladen):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    — bypassed RLS, sonst klappt der UPDATE nicht
 *   STRIPE_SECRET_KEY
 *   STRIPE_FOUNDER_COUPON_ID     — z.B. "founder-50-forever"
 *   RESEND_API_KEY
 *   NEXT_PUBLIC_SITE_URL         — default https://callday.io
 */

import { createElement } from "react";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Stripe from "stripe";
import { FounderCodeAtLaunch } from "../emails/founder-code-at-launch";

// ─── ENV + CLI ─────────────────────────────────────────────────────────

loadEnvConfig(process.cwd());

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_FOUNDER_COUPON_ID",
  "RESEND_API_KEY",
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[launch-send-codes] Missing env: ${key}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const onlyEmails = onlyArg
  ? onlyArg
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : null;

const stripeMode = process.env.STRIPE_SECRET_KEY!.startsWith("sk_live")
  ? "LIVE"
  : "TEST";

// ─── CLIENTS ────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const ELIGIBLE_STATUSES = ["approved", "launch_list", "active_beta"];
const COUPON_ID = process.env.STRIPE_FOUNDER_COUPON_ID!;
const RESEND_BATCH_LIMIT = 100;

// Code-Alphabet ohne ambigue Zeichen (kein 0/O, 1/I/L) — User wird den
// Code zwar primaer ueber den Link nutzen, aber falls er ihn aus der
// Mail abtippt sollte es eindeutig sein.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_SUFFIX_LENGTH = 6;

// ─── TYPES ──────────────────────────────────────────────────────────────

interface Application {
  id: string;
  email: string;
  name: string;
}

interface CodeGenResult {
  app: Application;
  code: string;
  promotionId: string;
}

interface CodeGenFailure {
  app: Application;
  error: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────

function generateCodeCandidate(): string {
  let suffix = "";
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `CALLDAY-${suffix}`;
}

/**
 * Codes haben ~31^6 = ~887M Kombinationen. Collision-Wahrscheinlichkeit
 * bei <100k Codes praktisch null, aber die UNIQUE-Constraint auf
 * applications.founder_code zwingt uns trotzdem zu einem Check. 10
 * Retries reichen mit massivem Sicherheitspuffer.
 */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCodeCandidate();
    const { data, error } = await supabase
      .from("applications")
      .select("id")
      .eq("founder_code", candidate)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase lookup failed: ${error.message}`);
    }
    if (!data) return candidate;
  }
  throw new Error("Could not generate unique code after 10 attempts");
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

// ─── PIPELINE-STEPS ─────────────────────────────────────────────────────

async function loadEligibleApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, email, name")
    .in("status", ELIGIBLE_STATUSES)
    .is("founder_code", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[launch-send-codes] Failed to load applications:", error);
    process.exit(1);
  }
  return data ?? [];
}

async function generateCodeForApplication(
  app: Application,
): Promise<CodeGenResult> {
  const code = await generateUniqueCode();

  // Stripe API-Version 2026-05-27.dahlia: coupon ist unter promotion
  // verschachtelt (vorher top-level coupon-Property).
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: COUPON_ID },
    code,
    max_redemptions: 1,
    metadata: {
      application_id: app.id,
      application_email: app.email,
    },
  });

  const { error: updateErr } = await supabase
    .from("applications")
    .update({ founder_code: code, stripe_promotion_id: promo.id })
    .eq("id", app.id);

  if (updateErr) {
    // Best-effort cleanup: Promotion-Code wieder deaktivieren damit kein
    // Waisen-Code im Stripe-Dashboard rumliegt. Failure hier ignorieren —
    // der Hauptfehler ist der Supabase-UPDATE-Fail.
    await stripe.promotionCodes
      .update(promo.id, { active: false })
      .catch(() => {});
    throw new Error(`Supabase update failed: ${updateErr.message}`);
  }

  return { app, code, promotionId: promo.id };
}

async function filterAlreadyEmailed(
  results: CodeGenResult[],
): Promise<{ toSend: CodeGenResult[]; alreadySent: CodeGenResult[] }> {
  if (results.length === 0) return { toSend: [], alreadySent: [] };

  const appIds = results.map((r) => r.app.id);
  const { data: logs, error } = await supabase
    .from("email_logs")
    .select("application_id")
    .in("application_id", appIds)
    .eq("email_type", "founder_code")
    .eq("status", "sent");

  if (error) {
    throw new Error(`Email-log lookup failed: ${error.message}`);
  }

  const sentSet = new Set((logs ?? []).map((l) => l.application_id));
  const toSend = results.filter((r) => !sentSet.has(r.app.id));
  const alreadySent = results.filter((r) => sentSet.has(r.app.id));
  return { toSend, alreadySent };
}

async function sendBatch(chunk: CodeGenResult[]): Promise<void> {
  const payload = chunk.map((r) => ({
    from: "Callday <hello@callday.io>",
    to: [r.app.email],
    replyTo: "hello@callday.io",
    subject: "Callday is live. Here's your founder code.",
    react: createElement(FounderCodeAtLaunch, {
      name: r.app.name,
      founderCode: r.code,
    }),
  }));

  const result = await resend.batch.send(payload);

  // Resend's batch response liefert ein data-Array in derselben
  // Reihenfolge wie der Input. Bei Komplett-Failure ist data null und
  // error ist gesetzt — dann sind alle items dieser Batch failed.
  if (result.error) {
    for (const r of chunk) {
      await insertEmailLog({
        applicationId: r.app.id,
        resendEmailId: null,
        status: "failed",
        errorMessage: result.error.message,
      });
    }
    console.error(`[launch-send-codes] batch failed: ${result.error.message}`);
    return;
  }

  const data = result.data?.data ?? [];
  for (let i = 0; i < chunk.length; i++) {
    const item = chunk[i];
    const sendResult = data[i];
    await insertEmailLog({
      applicationId: item.app.id,
      resendEmailId: sendResult?.id ?? null,
      status: sendResult ? "sent" : "failed",
      errorMessage: sendResult ? null : "no result in batch response",
    });
  }
}

async function insertEmailLog(args: {
  applicationId: string;
  resendEmailId: string | null;
  status: "sent" | "failed";
  errorMessage: string | null;
}): Promise<void> {
  const { error } = await supabase.from("email_logs").insert({
    application_id: args.applicationId,
    email_type: "founder_code",
    resend_email_id: args.resendEmailId,
    status: args.status,
    error_message: args.errorMessage,
  });
  if (error) {
    console.error(
      `[launch-send-codes] email_logs insert failed for ${args.applicationId}:`,
      error.message,
    );
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────");
  console.log(" Callday Launch-Day Script");
  console.log("─────────────────────────────────────────────");
  console.log(` Mode:        ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(` Stripe-Mode: ${stripeMode}`);
  console.log(` Coupon:      ${COUPON_ID}`);
  if (onlyEmails) {
    console.log(` Filter:      --only=${onlyEmails.join(",")}`);
  }
  console.log("─────────────────────────────────────────────\n");

  const allEligible = await loadEligibleApplications();

  const filtered = onlyEmails
    ? allEligible.filter((a) => onlyEmails.includes(a.email.toLowerCase()))
    : allEligible;

  if (filtered.length === 0) {
    if (onlyEmails && allEligible.length > 0) {
      console.log("No eligible applications match --only filter.");
      console.log(
        `(${allEligible.length} eligible without filter — check spelling/casing of --only.)`,
      );
    } else {
      console.log(
        "No eligible applications (status approved/launch_list/active_beta AND founder_code IS NULL).",
      );
    }
    return;
  }

  console.log(`Eligible: ${filtered.length} application(s)\n`);
  for (const app of filtered) {
    console.log(`  • ${app.email}  (${app.name})`);
  }
  console.log("");

  if (isDryRun) {
    console.log("[DRY-RUN] No codes generated, no emails sent. Done.");
    return;
  }

  // Live-Mode-Safeguard: extra Bestätigung BEVOR der normale "send"-Prompt.
  // Schützt vor versehentlichem Run mit Live-Keys ("ich dachte ich bin in
  // Test-Mode"). Im Test-Mode entfällt dieser Schritt — dort ist ein
  // versehentlicher Run unkritisch (keine echten Geldfluss-Codes).
  if (stripeMode === "LIVE") {
    console.log(
      "\n⚠  Stripe-Keys sind im LIVE-Mode. Generated codes sind REAL und\n" +
        "   verschickte Emails gehen an ECHTE Founder. Kein Rollback ohne\n" +
        "   manuellen DB- und Stripe-Cleanup.\n",
    );
    const liveAck = await prompt(
      `Type "LIVE" (uppercase) to acknowledge live-mode: `,
    );
    if (liveAck.trim() !== "LIVE") {
      console.log("Aborted — live-mode not acknowledged.");
      return;
    }
    console.log("");
  }

  const confirmMsg = `Type "send" to generate codes + send emails for ${filtered.length} application(s) [Stripe ${stripeMode}]: `;
  const answer = await prompt(confirmMsg);
  if (answer.trim().toLowerCase() !== "send") {
    console.log("Aborted.");
    return;
  }

  // ── Code-Generation (sequenziell — Stripe-API mag keinen Concurrent-
  //    Burst auf promotionCodes.create, und Supabase-UPDATEs sind eh
  //    serialisiert) ──
  const results: CodeGenResult[] = [];
  const failures: CodeGenFailure[] = [];

  for (const app of filtered) {
    try {
      const r = await generateCodeForApplication(app);
      console.log(`  ✓ ${app.email}  →  ${r.code}`);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${app.email}  →  ${msg}`);
      failures.push({ app, error: msg });
    }
  }

  // ── Idempotenz-Check + Send ──
  const { toSend, alreadySent } = await filterAlreadyEmailed(results);

  if (alreadySent.length > 0) {
    console.log(
      `\nSkipping ${alreadySent.length} email(s) — already sent (idempotency).`,
    );
  }

  let sendFailures = 0;
  if (toSend.length > 0) {
    console.log(`\nSending ${toSend.length} email(s)...`);
    for (let i = 0; i < toSend.length; i += RESEND_BATCH_LIMIT) {
      const chunk = toSend.slice(i, i + RESEND_BATCH_LIMIT);
      try {
        await sendBatch(chunk);
      } catch (err) {
        // sendBatch logged interne Fehler schon, aber wenn die Funktion
        // selbst throwt, zaehlen wir den ganzen Chunk als failed.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[launch-send-codes] sendBatch threw: ${msg}`);
        sendFailures += chunk.length;
      }
    }
  }

  // Sent-Failures aus email_logs final zaehlen — sendBatch hat bei
  // partial-failure einzelne items als 'failed' geloggt.
  const sentLogIds = toSend.map((r) => r.app.id);
  if (sentLogIds.length > 0) {
    const { data: finalLogs } = await supabase
      .from("email_logs")
      .select("application_id, status")
      .in("application_id", sentLogIds)
      .eq("email_type", "founder_code");
    const failedLogged = (finalLogs ?? []).filter(
      (l) => l.status === "failed",
    ).length;
    sendFailures = Math.max(sendFailures, failedLogged);
  }

  console.log("\n─── Summary ──────────────────────────────");
  console.log(` Codes generated:  ${results.length}`);
  console.log(` Codes failed:     ${failures.length}`);
  console.log(` Emails sent:      ${toSend.length - sendFailures}`);
  console.log(` Emails failed:    ${sendFailures}`);
  console.log(` Idempotent-skip:  ${alreadySent.length}`);
  console.log("──────────────────────────────────────────\n");

  if (failures.length > 0) {
    console.error("Code-generation failures (re-run safe, will retry):");
    for (const f of failures) {
      console.error(`  • ${f.app.email}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error("[launch-send-codes] fatal:", err);
  process.exit(1);
});
