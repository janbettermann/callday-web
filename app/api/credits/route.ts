/**
 * GET /api/credits — Credit-Zusammenfassung + Identitaet des eingeloggten
 * Users. Speist den Gold-Ring um die Avatar-Pille UND das Avatar-Popover
 * (Name/Email/Credits, Variante 03). Client-seitig im AppNav geladen,
 * damit die Werte ohne Prop-Threading auf jeder Seite erscheinen.
 * Seiteneffektfrei: legt keinen Grant an — der Signup-Grant entsteht
 * beim ersten Generator-Kontakt.
 */

import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { getCreditSummary } from "@/lib/lists/credits";
import { fetchProfileIdentity } from "@/lib/dashboard/data";

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

  const admin = getServerSupabase();
  try {
    const [credits, profile] = await Promise.all([
      getCreditSummary(admin, user.id),
      fetchProfileIdentity(admin, user.id, user.email ?? null),
    ]);
    return Response.json({
      credits,
      profile: { name: profile.name, email: profile.email },
    });
  } catch (err) {
    console.error("[api/credits] summary failed", err);
    return Response.json({ error: "credits_failed" }, { status: 500 });
  }
}
