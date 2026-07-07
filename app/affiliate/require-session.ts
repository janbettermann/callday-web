import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";

/**
 * Cookie-Gate fuer authed /affiliate/*-Server-Actions + -Pages. Returnt die
 * affiliate_id oder redirectet zu /affiliate/login. Eine Stelle, damit die
 * Auth-Boilerplate nicht pro actions.ts kopiert wird.
 */
export async function requireAffiliateId(): Promise<string> {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );
  if (!affiliateId) redirect("/affiliate/login");
  return affiliateId;
}
