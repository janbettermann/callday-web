import type { Metadata } from "next";
import Link from "next/link";
import { BoxIcon } from "../../components/BoxIcon";
import { BrainIcon } from "../../components/BrainIcon";
import { CalldayLogo } from "../../components/CalldayLogo";
import { FaqAccordion } from "../../components/FaqAccordion";
import { FlowTabs } from "../../components/FlowTabs";
import { GeneratorFeatureCard } from "../../components/GeneratorFeatureCard";
import { SignupModal } from "../../components/SignupModal";
import { SiteNav } from "../../components/SiteNav";
import { getServerSupabase } from "@/lib/supabase-server";
import { trackPageView } from "@/lib/affiliate-page-views";
import { BetaCta } from "../../components/BetaCta";
import { HeroCta } from "../../components/HeroCta";

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
 *   - **Anchor-Scroll** (`#signup`) statt Page-Switch. Hero-CTA und Nav-CTA
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
            Generate call list for free
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

          <HeroCta />
        </div>
      </section>

      {/* === THE FLOW === */}
      <section className="flow">
        <div className="container container-wide">
          <header className="flow-section-head">
            <h2>
              Take the friction
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
            {/* Zweiergespann statt 1-2-0-Trio (Jan 2026-07-23): die
                "2 taps"-Zelle doppelte woertlich den Flow-Step-03-Titel
                ("Booked in two taps"). 1 tap vs 0 tabs — ein Tap fuers
                Wesentliche, null Tabs fuer alles andere. */}
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
            {/* br-mobile: auf Phones bricht die Headline kontrolliert nach
                "to" um, Desktop bleibt einzeilig. */}
            Built to <br className="br-mobile" />
            fight the flinch.
          </h2>
          <p className="section-sub">
            Every detail closes a gap where focus usually dies.
          </p>

          <div className="feature-grid">
            <GeneratorFeatureCard />

            <div className="feature-card">
              <div className="feature-icon">
                {/* Quadratische Karte statt 18x13-Querformat (Jan
                    2026-07-23) — das flache Rechteck mit Strich oben las
                    sich wie eine Kreditkarte. 26px: das 16er-Quadrat hat
                    viel Luft in der ViewBox. */}
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x={4} y={4} width={16} height={16} rx={3} />
                  <path d="M4 9.5h16" />
                </svg>
              </div>
              <h3>One lead card at a time.</h3>
              <p>
                No menus. No clutter. One card, one decision: call or skip. Each
                tap pulls you deeper into the rhythm, never out of it.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <BrainIcon />
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
                {/* Papierflieger statt Kalender-Check (Jan 2026-07-23):
                    "Sent." ist der magische Moment der Karte — die Mail
                    fliegt raus, bevor der naechste Lead da ist. Leicht
                    nach unten links versetzt: die Flieger-Form lehnt
                    optisch nach oben rechts, der Versatz zentriert sie. */}
                <svg
                  width={23}
                  height={23}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3564e0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: "translate(-1px, 1px)" }}
                >
                  <line x1={22} y1={2} x2={11} y2={13} />
                  <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                </svg>
              </div>
              <h3>Booked. Synced. Sent.</h3>
              <p>
                One tap to log a meeting. Calendar event set, confirmation
                email sent, reminder email scheduled, all done before you
                reach the next lead. No app switching. No detour.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <BoxIcon />
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
          auf den slug (Affiliate-Attribution). Section-h2 hier, Card-Titel
          + Sub (linksbuendig) leben in der SignupForm. === */}
      <section className="big-cta" id="signup">
        <div className="container big-cta-inner">
          <BetaCta slug={slug} />
        </div>
      </section>

      {/* === FAQ === */}
      <section className="faq" aria-label="Common questions">
        <div className="container faq-inner">
          <h2 className="faq-heading">Common questions.</h2>
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

      {/* Sign-up-Modal (Hero-/Nav-„Get started" oeffnen es); portalt nach
          document.body. `slug` reist mit fuer die Affiliate-Attribution —
          identisch zur BetaCta oben. */}
      <SignupModal slug={slug} />
    </>
  );
}
