import Link from "next/link";
import { BetaApplicationForm } from "./components/BetaApplicationForm";
import { CalldayLogo } from "./components/CalldayLogo";
import { FaqAccordion } from "./components/FaqAccordion";
import { FlowTabs } from "./components/FlowTabs";
import { SiteNav } from "./components/SiteNav";

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <div className="bg-orb bg-orb-2" />

      {/* === NAV === */}
      <SiteNav />

      {/* === HERO — compact, mobile-first, no device mockup ===
          The product visual now lives in the animated 3-step flow directly
          below, so the hero stays small and gets the visitor scrolling fast. */}
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
            <a href="#beta" className="hero-cta">
              Get early access
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
              Free beta access. 50% off for life.
            </p>
          </div>
        </div>
      </section>

      {/* === THE FLOW — 3 animated steps (the centerpiece) ===
          Each step carries one workflow animation (placeholder for now). */}
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

      {/* === DIFFERENTIATORS — slimmed from the old 4-card grid ===
          The workflow mechanics now live in the animated flow above, so this
          keeps only the two "why it sticks" points that aren't shown there. */}
      <section className="features">
        <div className="container">
          <h2>
            Built to fight the <span className="italic">flinch</span>.
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

      {/* === BIG CTA — early-access signup. One form, two outcomes (closed
          beta or launch list) decided server-side; UI presents both as
          equal wins so nobody feels like a runner-up. === */}
      <section className="big-cta" id="beta">
        <div className="container big-cta-inner">
          <h2>
            Get <span className="italic">early access.</span>
          </h2>
          <p className="section-sub">
            Two ways in, same form. 50 testers get the app this week.
            Everyone gets a spot on the launch list and locks in{" "}
            <strong>founder pricing</strong> plus a{" "}
            <strong>free month</strong>.
          </p>

          <div className="outcome-cards">
            <div className="outcome-card">
              <div className="outcome-card-label">
                <span className="outcome-card-label-dot" />
                50 spots open
              </div>
              <h3 className="outcome-card-title">Closed beta</h3>
              <ul className="outcome-card-list">
                <li>
                  <CheckIcon />
                  Test the app for free today
                </li>
                <li>
                  <CheckIcon />
                  Founder pricing for life
                </li>
                <li>
                  <CheckIcon />
                  Help shape the product
                </li>
              </ul>
            </div>
            <div className="outcome-card">
              <div className="outcome-card-label">
                <span className="outcome-card-label-dot" />
                Secure benefits
              </div>
              <h3 className="outcome-card-title">Launch list</h3>
              <ul className="outcome-card-list">
                <li>
                  <CheckIcon />
                  Guaranteed spot
                </li>
                <li>
                  <CheckIcon />
                  Founder pricing for life
                </li>
                <li>
                  <CheckIcon />
                  1 month free at launch
                </li>
              </ul>
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-title">Save your spot</div>
            <p className="form-card-subtitle">Takes 60 seconds.</p>
            <BetaApplicationForm />
          </div>
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
