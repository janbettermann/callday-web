/**
 * POST /api/app-download-mail
 *
 * Schickt die Post-Signup-Mail ("You're in" + Weg zur App) an den
 * eingeloggten User. Hiess bis zum App-Store-Launch /api/testflight-invite
 * (und davor, bis 2026-07-05, /api/affiliate/post-signup — seit der
 * Sign-Up-Vereinheitlichung ist der Endpoint nicht mehr affiliate-
 * spezifisch).
 *
 * Auth-Modell (post Audit-Fix #5/#6):
 *   - Auth via Supabase-SSR-Session-Cookie. Nicht-eingeloggte Caller → 401.
 *   - Mail-Adresse kommt aus user.email — Caller kann KEINE Ziel-Adresse
 *     vorgeben. Das schliesst den unauthenticated-Mailer-Vektor (Audit
 *     #5); ein Account-Age-Gate gibt es seit Audit #6 nicht mehr.
 *   - Kein Body noetig — Attribution laeuft komplett durch den Trigger
 *     bzw /auth/callback.
 *
 * Einziger Caller: ConfirmCard (Email/PW-Pfad) nach erfolgreichem
 * verifyOtp, via requestAppDownloadMail in lib/signup-confirm.ts. Der
 * fruehere Resend-Button auf /account ist mit dem Entruempeln der Seite
 * (2026-07-24) entfallen — der Recovery-Pfad ist heute die "Get the app"-
 * Karte (GetAppCard auf /account und dem Dashboard).
 *
 * /auth/callback ruft NICHT diesen Endpoint sondern direkt
 * sendAppDownloadMail() (kein Self-HTTP-Roundtrip, Audit #7).
 */

import { after, type NextRequest } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { sendAppDownloadMail } from "@/lib/app-download-mail";
import {
  parseLpSignupContext,
  recordSignupConfirmed,
  requestInfoFrom,
} from "@/lib/lp/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  // Landing-Attribution (Split-Test-Funnel, lib/lp): die SignupForm hat
  // den Landing-Kontext als user_metadata.lp mitgegeben. Dieser Endpoint
  // wird genau einmal nach erfolgreichem verifyOtp gerufen — das ist der
  // Moment "bestaetigter Sign-up" fuer den Email/PW-Pfad. Doppelte Rows
  // faengt der Unique-Index auf lp_events ab. Laeuft nach der Antwort,
  // damit die Mail nicht auf das Tracking wartet.
  const lpCtx = parseLpSignupContext(user.user_metadata?.lp);
  if (lpCtx) {
    const info = requestInfoFrom((name) => request.headers.get(name));
    const origin = new URL(request.url).origin;
    const userId = user.id;
    const email = user.email;
    after(async () => {
      try {
        await recordSignupConfirmed({
          userId,
          email,
          ctx: lpCtx,
          info,
          sourceUrl: `${origin}/`,
        });
      } catch (err) {
        console.error("[app-download-mail] lp attribution failed", err);
      }
    });
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

  const result = await sendAppDownloadMail({
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
