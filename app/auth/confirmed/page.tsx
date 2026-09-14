import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "../../components/CalldayLogo";
import { SiteFooter } from "../../components/SiteFooter";
import { OpenAppLink } from "./OpenAppLink";

export const metadata: Metadata = {
  title: "Email confirmed · Callday",
  description:
    "Your email address is verified. Head back to the Callday app on your iPhone.",
  robots: { index: false, follow: false },
};

/**
 * Landing page that Supabase redirects to after a successful email
 * confirmation link. Server Component — no auth logic, no API calls.
 *
 * Supabase verifies the token server-side BEFORE the user's browser
 * lands here, so anyone reaching this URL is already confirmed. The
 * URL fragment (#access_token=…&refresh_token=…&type=signup) is meant
 * for the app's deep-link handler — OpenAppLink forwards it into the
 * `dealswipe://` scheme so the app can pick up the session.
 *
 * Seit die App den Sign-up per 8-stelligem Code bestaetigt
 * (onboarding/verify-email.tsx), ist diese Seite nur noch der Fallback
 * fuer den Link in der Bestaetigungsmail. Copy Englisch wie der Rest der
 * UI (bis 2026-09-14 stand hier noch deutscher Beta-Text).
 */
export default function AuthConfirmedPage() {
  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav className="site-nav">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
          <Link href="/" className="nav-cta">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="confirm-page">
        <div className="confirm-inner">
          <div className="confirm-icon">
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="confirm-headline">
            Email confirmed <span className="confirm-emoji">🎉</span>
          </h1>

          <p className="confirm-body">
            Your email address is now verified. Head back to the Callday app
            on your iPhone and sign in. That&apos;s where it starts.
          </p>

          <OpenAppLink className="hero-cta confirm-cta">
            Open Callday
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
          </OpenAppLink>

          <p className="confirm-note">
            Only works on an iPhone with Callday installed.
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
