import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalldayLogo } from "../../components/CalldayLogo";
import { getServerSupabase } from "@/lib/supabase-server";
import { AffiliateSignupForm } from "./AffiliateSignupForm";

/**
 * /a/[slug] — Founding-Affiliate-Sign-Up-Landing.
 *
 * Eintrittspunkt fuer die Founding-Affiliates-Links (Vertragsklausel:
 * Permanent-Link, bleibt stabil auch beim spaeteren Tracking-Tool-Wechsel
 * — siehe Memory: project_beta_affiliate_program).
 *
 * Verantwortung dieser Seite:
 *   1. Slug aus der URL aufloesen (service-role-Query gegen affiliates).
 *      Unknown / paused / removed → still rendert Form OHNE Pill, Sign-Up
 *      funktioniert weiter, FK bleibt null (silent fallback zu organic).
 *   2. Affiliate-Pill ("{Name} recommended Callday") rendern wenn aktiv.
 *   3. Sign-Up-Form mit Apple + Google + Email/PW rendern, slug wird durch
 *      den Sign-Up-Flow durchgereicht (Email/PW als user_metadata
 *      `referred_by_affiliate_slug`, OAuth als kurzlebiger
 *      `affiliate_slug`-Cookie der von /auth/callback gelesen wird —
 *      Supabase strippt Query-Params von redirectTo).
 *
 * **Kein Cookie fuer Marketing-Attribution** (Plan-Decision 2026-06-26).
 * Der OAuth-State-Cookie ist nur kurzlebiges Plumbing analog zum
 * existierenden `login_next`-Cookie, nicht das 30-Tage-Tracking-Cookie
 * das die Plan-Memory verworfen hat.
 *
 * Noindex: die Affiliate-URLs sollen nicht im Google-Index auftauchen.
 */

export const dynamic = "force-dynamic";

interface Affiliate {
  slug: string;
  name: string;
}

async function resolveAffiliate(slugRaw: string): Promise<Affiliate | null> {
  const slug = slugRaw.trim().toLowerCase();
  if (!slug || slug.length > 60) return null;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("affiliates")
    .select("slug, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[/a/[slug]] resolveAffiliate failed", error);
    return null;
  }
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const affiliate = await resolveAffiliate(slug);
  const title = affiliate
    ? `${affiliate.name} recommended Callday — Join the beta`
    : "Join the Callday beta";
  return {
    title,
    description:
      "Stop researching. Start calling. Get TestFlight access to the Callday beta.",
    robots: { index: false, follow: false },
  };
}

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugRaw } = await params;
  const slug = slugRaw.trim().toLowerCase();
  const affiliate = await resolveAffiliate(slug);

  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

      <main className="confirm-page">
        <Suspense fallback={null}>
          <AffiliateSignupForm slug={slug} affiliate={affiliate} />
        </Suspense>
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
