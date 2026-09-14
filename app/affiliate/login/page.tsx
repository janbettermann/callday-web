import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { CalldayLogo } from "@/app/components/CalldayLogo";

import { LoginForm } from "./LoginForm";

/**
 * /affiliate/login: Magic-Link-Login im Werkbank-Design (gleiche Karte
 * wie das Admin-Login). Eingeloggte werden direkt zum Dashboard
 * weitergeleitet.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Affiliate sign-in · Callday",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ email?: string; sent?: string; error?: string }>;
}

export default async function AffiliateLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const jar = await cookies();
  const sessionCookie = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  const affiliateId = await verifyAffiliateSession(sessionCookie);
  if (affiliateId) {
    redirect("/affiliate/dashboard");
  }

  const presetEmail = params.email ?? "";
  const sentToEmail = params.sent ?? null;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div className="wb-login">
      <div className="wb-login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CalldayLogo size={26} />
          <span className="wb-brand-name">Callday</span>
          <span className="wb-brand-tag">Affiliate</span>
        </div>
        {sentToEmail ? (
          <SentCard email={sentToEmail} />
        ) : (
          <LoginForm presetEmail={presetEmail} initialError={errorMessage} />
        )}
      </div>
    </div>
  );
}

function SentCard({ email }: { email: string }) {
  return (
    <div>
      <h1 className="wb-login-title">Check your inbox</h1>
      <p style={{ fontSize: 13, color: "var(--wb-ink-2)", marginTop: -12, lineHeight: 1.5 }}>
        If <strong style={{ color: "var(--wb-ink)" }}>{email}</strong> is registered as a Callday
        affiliate, a sign-in link is on its way. The link expires in 15 minutes.
      </p>
      <p style={{ fontSize: 13, color: "var(--wb-ink-3)", marginTop: 20 }}>
        Wrong email?{" "}
        <Link href="/affiliate/login" className="wb-link-blue">
          Start over
        </Link>
      </p>
    </div>
  );
}
