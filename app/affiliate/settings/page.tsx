import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getServerSupabase } from "@/lib/supabase-server";
import { PAYOUT_COLUMNS, mapPayout, type RawPayout } from "@/lib/affiliate-payout";
import { WbPanel } from "@/app/components/werkbank";

import { PortalShell } from "../PortalShell";
import { PayoutSettings } from "./PayoutSettings";

/**
 * /affiliate/settings: Payout-Methoden-Einrichtung (self-service PayPal/
 * Wise + Verify-Handshake) plus ein schlanker read-only Account-Block.
 * Die Auszahlungs-BETRAEGE leben auf /affiliate/payouts.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateSettingsPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );
  if (!affiliateId) redirect("/affiliate/login");

  const sb = getServerSupabase();
  const { data } = await sb
    .from("affiliates")
    .select(`email, ${PAYOUT_COLUMNS}`)
    .eq("id", affiliateId)
    .maybeSingle();

  if (!data) redirect("/affiliate/login");

  const row = data as unknown as { email: string } & RawPayout;
  const payout = mapPayout(row);

  return (
    <PortalShell
      current="settings"
      title="Settings"
      subtitle="Where your commission gets paid, and your account"
    >
      <WbPanel
        title="Payout method"
        subtitle="We send a small test transfer to a new method and you confirm it here before any real payout goes out"
        padded
      >
        <PayoutSettings payout={payout} />
      </WbPanel>

      <WbPanel title="Account" padded>
        <div className="wb-stack" style={{ gap: 16 }}>
          <div>
            <div className="wb-kv-label">Sign-in email</div>
            <div className="wb-kv-value">{row.email}</div>
            <div className="wb-hint">
              This is where your sign-in links go. Need to change it?{" "}
              <a href="mailto:hello@callday.io" className="wb-link-blue">
                Contact us
              </a>
              .
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--wb-line-soft)" }} />
          <div>
            <div className="wb-kv-label">Agreement</div>
            <Link href="/affiliate/agreement" className="wb-link-blue">
              View your affiliate agreement
            </Link>
          </div>
        </div>
      </WbPanel>
    </PortalShell>
  );
}
