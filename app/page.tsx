import Link from "next/link";
import { BetaApplicationForm } from "./components/BetaApplicationForm";
import { CalldayLogo } from "./components/CalldayLogo";
import { CalldayAppMockup } from "./components/CalldayAppMockup";

export default function Home() {
  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* === NAV === */}
      <nav className="site-nav">
        <div className="container nav-inner">
          <div className="logo">
            <CalldayLogo size={32} />
            Callday
          </div>
          <a href="#beta" className="nav-cta">
            Apply for beta
          </a>
        </div>
      </nav>

      {/* === HERO === */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
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
              procrastination. Callday builds calling momentum that survives
              the gaps where focus usually dies — keeping you on the phone,
              one tap at a time.
            </p>

            <div className="hero-cta-wrap reveal delay-3">
              <a href="#beta" className="hero-cta">
                Apply for a beta spot
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
                50 spots · Free for the full beta · iOS only · Launching 2026
              </p>
            </div>
          </div>

          <div className="hero-mockup">
            {/* Floating decoration cards */}
            <div className="floating-card calls-card">
              <div className="floating-icon green">
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className="floating-card-text">
                <strong>74 calls</strong>
                <span>today</span>
              </div>
            </div>

            <div className="floating-card meetings-card">
              <div className="floating-icon blue">
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
                </svg>
              </div>
              <div className="floating-card-text">
                <strong>4 meetings booked</strong>
                <span>today</span>
              </div>
            </div>

            <div className="floating-card closes-card">
              <div className="floating-icon gold">
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1={12} y1={2} x2={12} y2={22} />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="floating-card-text">
                <strong>1 close</strong>
                <span>today</span>
              </div>
            </div>

            <CalldayAppMockup />
          </div>
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

      {/* === FEATURES === */}
      <section className="features">
        <div className="container">
          <div className="section-label">// HOW IT WORKS</div>
          <h2>
            We take the <span className="italic">friction</span> out of cold
            calling.
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
                No menus. No clutter. One card, one decision: call or skip.
                Each tap pulls you deeper into the rhythm — never out of it.
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
                Every call counts — not just the yeses. Voicemails count.
                &ldquo;Not interested&rdquo; counts. Your brain learns to
                crave the dial, not the outcome.
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
                Zoom link — all sent before you reach the next lead. No app
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

      {/* === HOW IT WORKS === */}
      <section className="how-section">
        <div className="container">
          <div className="section-label">// THE FLOW</div>
          <h2>
            Three steps. <span className="italic">That&apos;s it.</span>
          </h2>

          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h4>Import your leads</h4>
              <p>
                Drop in a CSV or Excel sheet — or paste them in by hand. Your
                list is ready in under a minute. No setup. No system to build.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h4>Open the app and start your Callday</h4>
              <p>
                First lead is up. Tap to call. Tap to skip. Tap to log the
                outcome. The next lead is already there before you can
                second-guess yourself.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h4>Close the loop in two taps</h4>
              <p>
                Booked a meeting? Two taps and it&apos;s in your calendar with
                the confirmation email already sent. The next lead is up before
                procrastination can land.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === ROADMAP === */}
      <section className="roadmap">
        <div className="container">
          <div className="section-label">// ROADMAP</div>
          <h2>
            What ships in the beta.{" "}
            <span className="italic">What&apos;s coming next.</span>
          </h2>
          <p className="section-sub">
            Honest about what&apos;s live and what isn&apos;t. The
            friction-free core ships now. AI call briefings land later this
            year — beta testers get them free.
          </p>

          <div className="roadmap-grid">
            <div className="roadmap-card live">
              <div className="roadmap-status">
                <span className="status-dot live" />
                Shipping now · Beta
              </div>
              <h3>The calling loop</h3>
              <ul>
                <li>Tap-based card flow, one lead per card</li>
                <li>2-tap call outcome logging</li>
                <li>Calendar, email + Zoom auto-sync</li>
                <li>Lead tracking inside the app</li>
                <li>Reminder system for callbacks + follow-ups</li>
              </ul>
            </div>
            <div className="roadmap-card coming">
              <div className="roadmap-status">
                <span className="status-dot coming" />
                Coming · Later 2026
              </div>
              <h3>AI call briefings</h3>
              <ul>
                <li>Auto-analysis of every lead&apos;s business</li>
                <li>Three concrete talking points before you dial</li>
              </ul>
              <p className="roadmap-note">
                Beta testers keep their founder pricing when AI ships — at no
                extra cost.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === BIG CTA === */}
      <section className="big-cta" id="beta">
        <div className="container big-cta-inner">
          <div className="section-label">// BETA APPLICATION</div>
          <h2>
            50 spots. <span className="italic">First come, best fit.</span>
          </h2>
          <p className="section-sub">
            Callday&apos;s closed beta opens with 50 testers. Free for the
            full beta period. Founder pricing locked in for life when we
            launch publicly. We&apos;re prioritizing solo founders, freelancers,
            and small agencies who actually cold-call to grow.
          </p>

          <BetaApplicationForm />
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
            <a href="mailto:hello@callday.app">hello@callday.app</a>
          </div>
        </div>
      </footer>
    </>
  );
}
