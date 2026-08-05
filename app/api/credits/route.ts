/**
 * GET /api/credits — Credit-Zusammenfassung des eingeloggten Users
 * (used/total/balance). Speist den Fortschritts-Ring um die Avatar-Pille
 * (client-seitig im AppNav geladen, damit der Ring ohne Prop-Threading
 * auf jeder Seite erscheint). Seiteneffektfrei: legt keinen Grant an —
 * der Signup-Grant entsteht beim ersten Generator-Kontakt.
 */

import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { getCreditSummary } from "@/lib/lists/credits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const credits = await getCreditSummary(getServerSupabase(), user.id);
    return Response.json({ credits });
  } catch (err) {
    console.error("[api/credits] summary failed", err);
    return Response.json({ error: "credits_failed" }, { status: 500 });
  }
}
