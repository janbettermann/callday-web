/**
 * GET /affiliate/auth/callback?token=<32-byte-hex>
 *
 * Magic-Link-Verify-Endpoint. Token kommt aus der Welcome-Mail
 * (24h-TTL) oder einer regulaeren Sign-in-Mail (15-Min-TTL). Bei
 * success setzen wir den HMAC-Session-Cookie + redirecten zum
 * Dashboard.
 *
 * Failure-Modes (alle → /affiliate/login?error=<msg>):
 *   - missing token → "Sign-in link is incomplete."
 *   - unknown_token → "Sign-in link is invalid."
 *   - expired      → "Sign-in link expired. Request a new one."
 *   - already_used → "Sign-in link was already used."
 *   - removed      → "Your access was removed. Contact hello@callday.io."
 */

import { NextRequest, NextResponse } from "next/server";

import {
  affiliateCookieOptions,
  consumeMagicLink,
  signAffiliateSession,
} from "@/lib/affiliate-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, string> = {
  unknown_token: "Sign-in link is invalid.",
  expired: "Sign-in link expired. Request a new one below.",
  already_used: "Sign-in link was already used. Request a new one below.",
  removed:
    "Your access has been removed. Contact hello@callday.io if this is a mistake.",
  db_error: "Something went wrong. Try again in a moment.",
};

function redirectWithError(origin: string, code: string): NextResponse {
  const msg = ERROR_MESSAGES[code] ?? "Sign-in failed.";
  return NextResponse.redirect(
    `${origin}/affiliate/login?error=${encodeURIComponent(msg)}`,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      `${origin}/affiliate/login?error=${encodeURIComponent(
        "Sign-in link is incomplete.",
      )}`,
    );
  }

  const result = await consumeMagicLink(token);
  if (!result.ok) {
    return redirectWithError(origin, result.error);
  }

  const { value, expiresAt } = await signAffiliateSession(result.affiliateId);

  const response = NextResponse.redirect(`${origin}/affiliate/dashboard`);
  response.cookies.set({
    ...affiliateCookieOptions(expiresAt),
    value,
  });
  return response;
}
