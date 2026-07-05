import type { Metadata } from "next";
import Link from "next/link";
import { CalldayLogo } from "../../components/CalldayLogo";
import { FaqAccordion } from "../../components/FaqAccordion";
import { FlowTabs } from "../../components/FlowTabs";
import { SiteNav } from "../../components/SiteNav";
import { getServerSupabase } from "@/lib/supabase-server";
import { trackPageView } from "@/lib/affiliate-page-views";
import { SignupForm } from "../../components/SignupForm";

/**
 * /a/[slug] — Founding-Affiliate-Landing.
 *
 * Strukturell IDENTISCH zur organic Landing (app/page.tsx) — Hero,
 * Flow-Animations, Stats, Differentiators, FAQ, Footer, und seit
 * 2026-07-05 auch dasselbe SignupForm. Einziger Unterschied: hier
 * bekommt es den slug fuer die Affiliate-Attribution.
 *
 * Bewusste Entscheidungen (2026-06-26):
 *   - **Keine Affiliate-Pill.** Affiliate erscheint NIRGENDWO auf der
 *     Seite. Attribution laeuft komplett im Backend (Trigger fuer
 *     Email/PW, /auth/callback fuer OAuth). Macht das Erlebnis fuer
 *     den Klicker identisch zu organic — er bekommt denselben Pitch,
 *     denselben Form-Hub, ohne dass Joe's Name irgendwo ablenkt.
 *   - **Anchor-Scroll** (`#beta`) statt Page-Switch. Hero-CTA und Nav-CTA
 *     zeigen zur Form-Section auf derselben Page.
 *   - **Slug-Resolve** server-side per service-role: liefert die
 *     affiliate_id fuer Click-Tracking (auch bei paused/unknown
 *     Slugs wird der Page-View getrackt, dann mit affiliate_id=null —
 *     Sign-Up faellt silent zurueck auf organic).
 *   - **Click-Tracking** via trackPageView (lib/affiliate-page-views.ts).
 *     Eigenes Layer in Supabase statt 3rd-Party — Dashboard-Joins mit
 *     profiles + lead_lists werden trivial. Bot-Filter via UA-Regex,
 *     visitor_hash = sha256(IP+UA+daily-salt) fuer Unique-Counts ohne
 *     PII. Soft-failure: INSERT-Fehler blockt Render NICHT.
 *
 * NoIndex: die Affiliate-URLs sollen nicht im Google-Index auftauchen.
 */

export const dynamic = "force-dynamic";

interface Affiliate {
  id: string;
  slug: string;
  name: string;
}

async function resolveAffiliate(slugRaw: string): Promise<Affiliate | null> {
  const slug = slugRaw.trim().toLowerCase();
  if (!slug || slug.length > 60) return null;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("affiliates")
    .select("id, slug, name")
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
  // Metadaten bleiben generisch — Affiliate-Name nirgendwo sichtbar.
  await params;
  return {
    title: "Callday. Make today a Callday.",
    description:
      "The cold calling app for solo founders and freelancers. Less avoiding. More dialing.",
    robots: { index: false, follow: false },
  };
}

export default async function AffiliateLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugRaw } = await params;
  const slug = slugRaw.trim().toLowerCase();
  const affiliate = await resolveAffiliate(slug);

  await trackPageView({ slug, affiliateId: affiliate?.id ?? null });

  return (
    <>
      <div className="bg-orb bg-orb-2" />

      {/* === NAV === */}
      <SiteNav />

      {/* === HERO === */}
      <section className="hero hero-light">
        <div className="container hero-inner">
          <div className="pill reveal">
            <span className="pill-dot" />
            Make today a Callday.
          </div>

          <h1 className="reveal delay-1">
            Less avoiding.
            <br />
            More <span className="accent">dialing</span>.
          </h1>

          <p className="hero-sub reveal delay-2">
            Cold callers don&apos;t lose to bad scripts. They lose to
            procrastination. Callday keeps you on the phone, one tap at a time.
          </p>

          <div className="hero-cta-wrap reveal delay-3">
            <a href="#beta" className="hero-cta">
              Get early access
            </a>
            <p className="hero-cta-meta">
              Start calling today. Free iOS beta.
            </p>
          </div>
        </div>
      </section>

      {/* === THE FLOW === */}
      <section className="flow">
        <div className="container">
          <header className="flow-section-head">
            <h2>
              Take the <span className="accent">friction</span>
              <br /> out of cold calling.
            </h2>
          </header>
          <FlowTabs />
        </div>
      </section>

      {/* === STATS === */}
      <section className="social-proof">
        <div className="container">
          <div className="stats-block">
            <div className="stats-row">
              <div className="stat-cell">
                <div className="stat-num">
                  1<span className="unit">tap</span>
                </div>
                <div className="stat-label">to your next call</div>
              </div>
              <div className="stat-divider" />
              <div className="stat-cell">
                <div className="stat-num">
                  2<span className="unit">taps</span>
                </div>
                <div className="stat-label">
                  booked meeting → calendar + email sent
                </div>
              </div>
              <div className="stat-divider" />
              <div className="stat-cell">
                <div className="stat-num">
                  0<span className="unit">tabs</span>
                </div>
                <div className="stat-label">
                  no spreadsheet, no detours, no distractions
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === DIFFERENTIATORS === */}
      <section className="features">
        <div className="container">
          <h2>
            Built to fight the <span className="accent">flinch</span>.
          </h2>
          <p className="section-sub">
            Every detail closes a gap where focus usually dies.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x={3} y={6} width={18} height={13} rx={2} />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <h3>One card at a time.</h3>
              <p>
                No menus. No clutter. One card, one decision: call or skip. Each
                tap pulls you deeper into the rhythm, never out of it.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3>Rewards the dial, not the close.</h3>
              <p>
                Every call counts, not just the yeses. Voicemails count.
                &ldquo;Not interested&rdquo; counts. Your brain learns to crave
                the dial, not the outcome.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
                  <line x1={16} y1={2} x2={16} y2={6} />
                  <line x1={8} y1={2} x2={8} y2={6} />
                  <line x1={3} y1={10} x2={21} y2={10} />
                  <polyline points="9 16 11 18 15 14" />
                </svg>
              </div>
              <h3>Booked. Synced. Sent.</h3>
              <p>
                One tap to log a meeting. Calendar event, confirmation email,
                Zoom link, all sent before you reach the next lead. No app
                switching. No detour.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3>No CRM. No spreadsheet.</h3>
              <p>
                Every call, note, and outcome stays in the app. No pipeline
                to maintain. No spreadsheet to update. The system is the
                calling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === BIG CTA — Account-Sign-Up, identisch zur organic Landing bis
          auf den slug (Affiliate-Attribution). Headline + Sub leben IN der
          Card (self-contained wie die /login-Card), daher kein h2 hier. === */}
      <section className="big-cta" id="beta">
        <div className="container big-cta-inner">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SignupForm slug={slug} />
          </div>
        </div>
      </section>

      {/* === FAQ === */}
      <section className="faq" aria-label="Common questions">
        <div className="container faq-inner">
          <h2 className="faq-heading">
            Common <span className="accent">questions.</span>
          </h2>
          <FaqAccordion />
        </div>
      </section>

      {/* === FOOTER === */}
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
