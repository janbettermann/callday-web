/**
 * GET /api/dev/login — lokaler Auto-Login als Test-User, NUR im Dev.
 *
 * Zweck: Claude Code darf keine Passwoerter in Formulare tippen, soll
 * aber den eingeloggten Bereich (Dashboard, /lists, /account) selbst
 * verifizieren koennen. Diese Route setzt die Session-Cookies fuer den
 * Test-User aus DEV_LOGIN_EMAIL, ohne dass jemand ein Passwort eingibt.
 * Mechanik = Magic-Link ohne Mail: generateLink liefert den Einmal-
 * Token, verifyOtp loest ihn sofort ein (setzt die Cookies ueber den
 * SSR-Adapter, wie /auth/callback), dann Redirect ins Dashboard.
 *
 * Zwei unabhaengige Sperren, beide muessen offen sein — sonst 404, als
 * gaebe es die Route nicht:
 *   1. NODE_ENV === "development" (Vercel baut mit "production")
 *   2. DEV_LOGIN_EMAIL gesetzt (steht nur in .env.local, die ist
 *      gitignored und existiert auf Vercel nicht)
 *
 * Der Test-User muss existieren — type "magiclink" legt keinen an.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const email = process.env.DEV_LOGIN_EMAIL;
  if (process.env.NODE_ENV !== "development" || !email) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = getServerSupabase();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json(
      { error: "generate_link_failed", detail: linkError?.message ?? null },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseSSR();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    return NextResponse.json(
      { error: "verify_failed", detail: verifyError.message },
      { status: 500 },
    );
  }

  return NextResponse.redirect(`${request.nextUrl.origin}/dashboard`);
}
