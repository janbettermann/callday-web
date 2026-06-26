/**
 * POST /api/affiliate/post-signup
 *
 * Triggert die TestFlight-Invite-Mail an den eingeloggten User.
 *
 * Auth-Modell (post Audit-Fix #5/#6):
 *   - Auth via Supabase-SSR-Session-Cookie. Nicht-eingeloggte Caller → 401.
 *   - Mail-Adresse kommt aus user.email — Caller kann KEINE Ziel-Adresse
 *     vorgeben. Das schliesst den unauthenticated-Mailer-Vektor (Audit
 *     #5) und entfernt das 1h-Account-Age-Gate (Audit #6, Resend-Button
 *     funktioniert dauerhaft).
 *   - Kein Body noetig — der frueher uebergebene `slug` wurde ohnehin
 *     nirgends verwertet, Attribution laeuft komplett durch den Trigger
 *     bzw /auth/callback.
 *
 * Caller:
 *   - AffiliateSignupForm (Email/PW-Pfad) nach erfolgreichem verifyOtp
 *   - ResendTestFlightButton auf /account
 *
 * /auth/callback ruft NICHT mehr diesen Endpoint sondern direkt
 * sendTestflightInvite() (kein Self-HTTP-Roundtrip mehr, Audit #7).
 */

import { NextRequest } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { sendTestflightInvite } from "@/lib/affiliate-invite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  // Profile-Lookup ueber service-role weil profiles RLS u.U. noch nicht
  // greift wenn das Profil gerade erst per Trigger angelegt wurde (Race
  // theoretisch moeglich, Lookup robuster).
  const admin = getServerSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    (profile?.name && profile.name.trim()) ||
    (user.user_metadata?.full_name as string | undefined) ||
    "there";

  const result = await sendTestflightInvite({
    toEmail: user.email,
    displayName,
  });

  if (result.status === "failed") {
    return Response.json(
      { error: result.error ?? "send failed" },
      { status: 500 },
    );
  }

  return Response.json({ success: true, status: result.status });
}
