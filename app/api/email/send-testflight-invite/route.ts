/**
 * POST /api/email/send-testflight-invite
 *
 * Trigger: Supabase Database Webhook auf UPDATE von public.applications
 * wenn status zu 'approved' wechselt. Sendet die TestFlightInvite-Email.
 *
 * Logik komplett in lib/lifecycle-email.ts — diese Route ist nur die
 * dünne Konfiguration.
 */

import { NextRequest } from "next/server";
import { TestFlightInvite } from "@/emails/testflight-invite";
import { handleLifecycleWebhook } from "@/lib/lifecycle-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleLifecycleWebhook(request, {
    expectedStatus: "approved",
    emailType: "testflight_invite",
    subject: "You're in. Welcome to the Callday beta.",
    Template: TestFlightInvite,
  });
}
