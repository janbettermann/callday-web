import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CalldayLogo } from "../../components/CalldayLogo";
import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";

import { LoginForm } from "./LoginForm";

/**
 * /affiliate/login — Sign-in-Form fuer Affiliates.
 *
 * Magic-Link-only. Eingeloggte User werden direkt zum Dashboard
 * weitergeleitet. Ansonsten Email-Form, Submit triggert Server-Action
 * (siehe actions.ts) die einen Token erzeugt + Mail verschickt. UX-
 * Pattern wie /a/[slug] und /login (cream bg, login-card style).
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

  // Bereits eingeloggt? → /affiliate/dashboard
  const jar = await cookies();
  const sessionCookie = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  const affiliateId = await verifyAffiliateSession(sessionCookie);
  if (affiliateId) {
    redirect("/affiliate/dashboard");
  }

  const presetEmail = params.email ?? "";
  const sentToEmail = params.sent ?? null;
  const errorMessage = params.error
    ? decodeURIComponent(params.error)
    : null;

  return (
    <>
      <div className="bg-orb bg-orb-2" />

      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

      <main className="confirm-page">
        {sentToEmail ? (
          <SentCard email={sentToEmail} />
        ) : (
          <LoginForm presetEmail={presetEmail} initialError={errorMessage} />
        )}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="logo">
            <CalldayLogo size={28} />
            Callday
          </div>
          <div className="footer-tagline">MAKE TODAY A CALLDAY.</div>
          <div className="footer-meta">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function SentCard({ email }: { email: string }) {
  return (
    <div className="login-card">
      <h1 className="login-headline">Check your inbox.</h1>
      <p className="login-sub">
        If <strong>{email}</strong> is registered as a Callday affiliate, a
        sign-in link is on its way. The link expires in 15 minutes.
      </p>
      <p
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "var(--ink-faint)",
          marginTop: 28,
        }}
      >
        Wrong email?{" "}
        <Link
          href="/affiliate/login"
          className="login-text-link login-text-link-strong"
        >
          Start over
        </Link>
      </p>
    </div>
  );
}
