/**
 * GET /auth/callback?code=PKCE_CODE
 *   oder /auth/callback?error=...&error_description=...
 *
 * Supabase OAuth- und Magic-Link-Callback. Der User kommt entweder
 * vom Mail-Link (Magic-Link, aktuell wenig genutzt) oder vom OAuth-
 * Provider-Redirect (Apple, Google) hierher. In beiden Fällen tauschen
 * wir den PKCE-Code für eine Session (setzt Auth-Cookies), dann
 * redirect zum Ziel aus dem `login_next`-Cookie (von /login vor dem
 * signInWithOAuth/signInWithOtp gesetzt).
 *
 * Cookie statt Query-Param weil Supabase das URL-Matching gegen die
 * Allow-List path-strict macht und Query-Strings dabei verschluckt
 * werden können. Cookie hält das Ziel sauber zwischen Login-Form und
 * Callback.
 *
 * Bei OAuth-Cancel oder -Fehler kommt der User mit ?error=... zurück.
 * Wir leiten dann zu /login mit der Fehlermeldung weiter.
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
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  // next aus dem Cookie holen (gesetzt von /login vor signInWithOAuth/Otp)
  const nextCookie = request.cookies.get("login_next")?.value;
  const next = safeNextPath(nextCookie);

  // OAuth-Provider-Error: User hat abgebrochen oder Provider hat genackt.
  // Wir leiten zu /login mit lesbarer Meldung — fallback auf den raw error.
  if (oauthError) {
    const message = oauthErrorDescription || oauthError;
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );
    response.cookies.delete("login_next");
    return response;
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing auth code")}`,
    );
  }

  const supabase = await createSupabaseSSR();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
    response.cookies.delete("login_next");
    return response;
  }

  // Erfolgreich — login_next-Cookie löschen, dann Redirect
  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete("login_next");
  return response;
}
