import "../werkbank.css";

/**
 * Layout des Affiliate-Portals (/affiliate/*): Werkbank-Design wie der
 * Admin. `.wb` traegt Tokens, Systemschrift und den grauen Grund und
 * ueberschreibt damit die Marketing-Defaults aus globals.css. Gilt auch
 * fuer /affiliate/login; robots-noindex setzen die Seiten selbst.
 */
export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return <div className="wb">{children}</div>;
}
