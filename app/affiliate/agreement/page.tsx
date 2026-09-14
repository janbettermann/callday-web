import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { WbPanel } from "@/app/components/werkbank";

import { PortalShell } from "../PortalShell";

/**
 * /affiliate/agreement: Container fuer den Affiliate-Vertrag. Der finale
 * Text kommt vom Anwalt; bis dahin ein ehrlicher Platzhalter. Erreichbar
 * ueber Settings (Account), deshalb dort als aktiver Bereich markiert.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agreement · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateAgreementPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  return (
    <PortalShell
      current="settings"
      title="Affiliate agreement"
      subtitle="The terms of the Callday founding-affiliate program"
    >
      <WbPanel title="Agreement" padded>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
          Your affiliate agreement is being finalized.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--wb-ink-2)" }}>
          Once it&apos;s ready, the full terms will live right here and we&apos;ll email you a
          copy. Questions in the meantime? Reach us at{" "}
          <a href="mailto:hello@callday.io" className="wb-link-blue">
            hello@callday.io
          </a>
          .
        </p>
      </WbPanel>
    </PortalShell>
  );
}
