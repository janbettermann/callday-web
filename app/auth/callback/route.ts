/**
 * GET /auth/callback?code=PKCE_CODE
 *
 * Supabase Magic-Link-Callback. Der User klickt den Link in der Mail,
 * Supabase verifiziert das Token + redirected hierher mit einem PKCE-
 * Code. Wir tauschen den Code für eine Session (setzt Auth-Cookies),
 * dann redirect zum Ziel aus dem `login_next`-Cookie (von /login
 * vor dem signInWithOtp gesetzt).
 *
 * Cookie statt Query-Param weil Supabase das URL-Matching gegen die
 * Allow-List path-strict macht und Query-Strings dabei verschluckt
 * werden können. Cookie hält das Ziel sauber zwischen Login-Form und
 * Callback.
 *
 * Open-Redirect-Protection: das next aus dem Cookie muss eine relative
 * URL sein (mit / beginnen, kein //, kein protocol). Sonst Fallback "/".
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // next aus dem Cookie holen (gesetzt von /login vor signInWithOtp)
  const nextCookie = request.cookies.get("login_next")?.value;
  const next = safeNextPath(nextCookie);

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing auth code")}`,
    );
  }

  const supabase = await createSupabaseSSR();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Erfolgreich — login_next-Cookie löschen, dann Redirect
  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete("login_next");
  return response;
}
