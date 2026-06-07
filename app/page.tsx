import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "./components/CalldayLogo";
import { FaqAccordion } from "./components/FaqAccordion";
import { FlowTabs } from "./components/FlowTabs";
import { LaunchSiteNav } from "./components/LaunchSiteNav";
import { createSupabaseSSR } from "@/lib/supabase-ssr";

/**
 * / — Public-Launch-Landing-Page.
 *
 * Lebt auf dem `launch-prep`-Branch. Wird beim Launch-Day-Merge nach
 * `main` der neue Homepage-Content auf callday.io. Die Beta-Application-
 * Landing (Waitlist-Form) bleibt auf `main` bis zum Merge-Cutover.
 *
 * Branch-Strategie:
 *   - `main`           → callday.io (Beta-Landing)
 *   - `launch-prep`    → preview-URL (Launch-Landing, diese Datei)
 *   - Launch-Day       → merge launch-prep → main → callday.io zeigt Launch
 *
 * Im Vergleich zur Beta-Page:
 *   - Hero-CTA + Sprache auf Vollpreis-Public-Launch (statt
 *     "Get early access" → "Get Callday", statt "free beta access" →
 *     "Cancel anytime"-Hinweis).
 *   - BetaApplicationForm-Section ersetzt durch Pricing-Section mit
 *     Plan-Cards (Monthly + Yearly), die zu /checkout?plan=... führen.
 *   - Nav: "Sign in"-Link für existierende User + "Get Callday"-CTA.
 */

export const metadata: Metadata = {
  title: "Callday — Make today a Callday.",
  description:
    "The cold calling app for solo founders and freelancers. Less avoiding. More dialing.",
};

export default async function LandingPage() {
  // Nav zeigt "Account" statt "Sign in" wenn User eingeloggt ist.
  // Ohne diesen Check würde "Sign in" auch eingeloggten Usern angezeigt,
  // was verwirrend ist wenn sie auf einen Plan klicken und ohne Login-
  // Page direkt zu Stripe gelangen.
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

  return (
    <>
      <div className="bg-orb bg-orb-2" />

      {/* === NAV ===
          LaunchSiteNav ist das Launch-Page-Pendant zu SiteNav (Beta).
          Beide haben dieselbe Scroll-Detection-Logik (dunkel im Hero,
          hell danach), aber unterschiedlichen Nav-Content. Vorher war
          hier eine inline `<nav data-scrolled="true">` mit hartem
          Light-Mode — Header blieb auch im dunklen Hero hell, weil das
          Attribut konstant war. */}
      <LaunchSiteNav isAuthed={isAuthed} />

      {/* === HERO === */}
      <section className="hero">
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
            <a href="#pricing" className="hero-cta">
              Get Callday
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1={5} y1={12} x2={19} y2={12} />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
            <p className="hero-cta-meta">
              From €24.99/month. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* === THE FLOW === */}
      <section className="flow">
        <div className="container">
          <header className="flow-section-head">
            <h2>
              Take the <span className="italic">friction</span>
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
            Built to fight the <span className="italic">flinch</span>.
          </h2>
          <p className="section-sub">
            Four mechanics. Each one closes a gap where focus usually dies.
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
                Every call, note, and outcome lives inside the app. No Notion
                pipeline to maintain. No spreadsheet to update. The system is
                the calling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === PRICING — replaces BetaApplicationForm section === */}
      <section className="pricing-section" id="pricing">
        <div className="container">
          <h2>
            Simple <span className="italic">pricing.</span>
          </h2>
          <p className="section-sub">
            One plan, two payment cycles. Cancel anytime.
          </p>

          <div className="pricing-grid">
            {/* Yearly — Best Value */}
            <div className="pricing-card pricing-card-best">
              <span className="pricing-card-badge">Best value</span>
              <div className="pricing-card-name">Yearly</div>
              <div className="pricing-card-price">
                €199<span className="pricing-card-period">/year</span>
              </div>
              <div className="pricing-card-savings">
                €16.58/month — save ~33% vs monthly
              </div>
              <ul className="pricing-card-list">
                <li>Unlimited lead lists</li>
                <li>Built-in iOS calendar sync</li>
                <li>Auto meeting confirmations</li>
                <li>iPhone app (App Store)</li>
                <li>Cancel anytime</li>
              </ul>
              <Link
                href="/checkout?plan=yearly"
                className="pricing-card-cta pricing-card-cta-primary"
              >
                Get Callday Yearly
              </Link>
            </div>

            {/* Monthly */}
            <div className="pricing-card">
              <div className="pricing-card-name">Monthly</div>
              <div className="pricing-card-price">
                €24.99<span className="pricing-card-period">/month</span>
              </div>
              <div className="pricing-card-savings">Billed monthly</div>
              <ul className="pricing-card-list">
                <li>Unlimited lead lists</li>
                <li>Built-in iOS calendar sync</li>
                <li>Auto meeting confirmations</li>
                <li>iPhone app (App Store)</li>
                <li>Cancel anytime</li>
              </ul>
              <Link
                href="/checkout?plan=monthly"
                className="pricing-card-cta"
              >
                Get Callday Monthly
              </Link>
            </div>
          </div>

          <p className="pricing-meta">
            Payment via Stripe — we never see your card. Already a customer?{" "}
            <Link href="/account">Manage subscription</Link>.
          </p>
        </div>
      </section>

      {/* === FAQ === */}
      <section className="faq" aria-label="Common questions">
        <div className="container faq-inner">
          <h2 className="faq-heading">
            Common <span className="italic">questions.</span>
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
