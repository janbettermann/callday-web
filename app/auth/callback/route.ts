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
 *
 * Affiliate-Attribution (Phase 1 Affiliate-Programm):
 *   /a/[slug] setzt vor signInWithOAuth den Cookie `affiliate_slug`
 *   (analog zum login_next-Cookie, da Supabase Query-Params von
 *   redirectTo strippt). Nach erfolgreichem PKCE-Exchange resolven wir
 *   den Slug gegen affiliates und UPDATEn profiles.referred_by_affiliate_id
 *   — nur wenn aktuell null (idempotent gegen Re-Login derselben User).
 *   Bei neu angelegtem Profil triggern wir ausserdem die TestFlight-Mail
 *   ueber /api/affiliate/post-signup.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { sendTestflightInvite } from "@/lib/affiliate-invite";

export const dynamic = "force-dynamic";

const AFFILIATE_PROFILE_FRESHNESS_MS = 5 * 60 * 1000;

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

/**
 * Loescht alle State-Cookies die /a/[slug] und /login vor OAuth setzen.
 * MUSS auf JEDEM Exit-Pfad von /auth/callback gerufen werden, sonst
 * leakt z.B. `affiliate_slug` ueber Cancel-Flows in einen nachfolgenden
 * /login-Sign-In und attribuiert organische User an einen Affiliate.
 */
function clearAuthStateCookies(response: NextResponse): void {
  response.cookies.delete("login_next");
  response.cookies.delete("affiliate_slug");
  response.cookies.delete("affiliate_signup_provider");
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
    clearAuthStateCookies(response);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing auth code")}`,
    );
    clearAuthStateCookies(response);
    return response;
  }

  const supabase = await createSupabaseSSR();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
    clearAuthStateCookies(response);
    return response;
  }

  // Affiliate-Attribution + Post-Signup-Mail.
  // Soft-failure: alle Schritte sind try/catched, ein Fehler hier
  // unterbricht den Login-Flow nicht — Attribution-Loss waere
  // suboptimal, aber Login-Abbruch nach erfolgreichem OAuth waere
  // schlimmer.
  const affiliateSlug = decodeAffiliateSlug(
    request.cookies.get("affiliate_slug")?.value,
  );
  if (affiliateSlug) {
    try {
      await attachAffiliateAttribution(supabase, affiliateSlug);
    } catch (err) {
      console.error("[/auth/callback] affiliate attribution failed", err);
    }
  }

  // Erfolgreich — login_next + affiliate-Cookies löschen, dann Redirect.
  const response = NextResponse.redirect(`${origin}${next}`);
  clearAuthStateCookies(response);
  return response;
}

function decodeAffiliateSlug(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  value = value.trim().toLowerCase();
  if (!value || value.length > 60) return null;
  // Slug-Format: lowercase, alphanumeric + dash. Defensive Whitelist gegen
  // beliebige Werte im Cookie.
  if (!/^[a-z0-9-]+$/.test(value)) return null;
  return value;
}

async function attachAffiliateAttribution(
  ssrClient: Awaited<ReturnType<typeof createSupabaseSSR>>,
  slug: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await ssrClient.auth.getUser();
  if (!user) return false;

  // Service-Role brauchen wir hier weil:
  //   1. RLS auf affiliates ist Admin-only
  //   2. UPDATE auf profiles muss "where referred_by_affiliate_id IS NULL"
  //      hart geprueft werden, idempotent gegen Re-Logins
  const admin = getServerSupabase();

  const { data: affiliate } = await admin
    .from("affiliates")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!affiliate) return false; // Slug unknown / paused — silent skip

  // Idempotenter UPDATE: setzen nur wenn noch null. Verhindert dass ein
  // existierender Affiliate-A-User der spaeter via /a/affiliate-b einloggt
  // umattribuiert wird.
  await admin
    .from("profiles")
    .update({ referred_by_affiliate_id: affiliate.id })
    .eq("id", user.id)
    .is("referred_by_affiliate_id", null);

  // Frischer Sign-Up? Profil in den letzten 5 Min angelegt → ja.
  // Schuetzt Mail-Spam wenn ein existierender User nochmal ueber den
  // Affiliate-Link kommt (sonst kriegt er bei jedem Re-Login eine
  // TestFlight-Mail).
  const { data: profile } = await admin
    .from("profiles")
    .select("email, name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.email || !profile.created_at) return false;

  const createdMs = new Date(profile.created_at).getTime();
  if (Date.now() - createdMs > AFFILIATE_PROFILE_FRESHNESS_MS) return false;

  // Direkter Funktions-Call statt Self-HTTP-Roundtrip — siehe
  // lib/affiliate-invite.ts. sendTestflightInvite returnt strukturiert
  // statt zu throwen, daher kein try/catch noetig.
  const displayName =
    (profile.name && profile.name.trim()) ||
    (user.user_metadata?.full_name as string | undefined) ||
    "there";
  await sendTestflightInvite({
    toEmail: profile.email,
    displayName,
  });

  return true;
}
