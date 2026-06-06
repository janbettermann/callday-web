/**
 * POST /api/email/send-launch-list-welcome
 *
 * Trigger: Supabase Database Webhook auf UPDATE von public.applications
 * wenn status zu 'launch_list' wechselt. Sendet die LaunchListWelcome-Email.
 *
 * Logik komplett in lib/lifecycle-email.ts — diese Route ist nur die
 * dünne Konfiguration.
 */

import { NextRequest } from "next/server";
import { LaunchListWelcome } from "@/emails/launch-list-welcome";
import { handleLifecycleWebhook } from "@/lib/lifecycle-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleLifecycleWebhook(request, {
    expectedStatus: "launch_list",
    emailType: "launch_list_welcome",
    subject: "You're on the Callday launch list",
    Template: LaunchListWelcome,
  });
}
