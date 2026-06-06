/**
 * GET /auth/callback?code=PKCE_CODE&next=<path>
 *
 * Supabase Magic-Link-Callback. Der User klickt den Link in der Mail,
 * Supabase verifiziert das Token + redirected hierher mit einem PKCE-
 * Code. Wir tauschen den Code für eine Session (setzt Auth-Cookies),
 * dann redirect zum next-Param.
 *
 * Open-Redirect-Protection: `next` muss eine relative URL sein (mit /
 * beginnen, kein //, kein protocol). Sonst Fallback auf "/".
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  // Decode in case it was urlencoded
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  // Must be a relative path starting with single /
  // Reject protocol-relative (//) and absolute (http://) URLs
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    // Kein Code → Fehler-Redirect zur Login-Page
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

  return NextResponse.redirect(`${origin}${next}`);
}
