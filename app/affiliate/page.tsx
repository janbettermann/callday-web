import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";

/**
 * /affiliate — Entry-Point. Redirected je nach Cookie:
 *   - eingeloggt → /affiliate/dashboard
 *   - nicht eingeloggt → /affiliate/login
 */

export const dynamic = "force-dynamic";

export default async function AffiliateIndex() {
  const jar = await cookies();
  const sessionCookie = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  const affiliateId = await verifyAffiliateSession(sessionCookie);

  if (affiliateId) {
    redirect("/affiliate/dashboard");
  }
  redirect("/affiliate/login");
}
