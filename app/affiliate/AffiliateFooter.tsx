import Link from "next/link";

import { CalldayLogo } from "../components/CalldayLogo";

/** Footer der authentifizierten Affiliate-Seiten (Dashboard/Posts/Activity/Agreement). */
export function AffiliateFooter() {
  return (
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
  );
}
