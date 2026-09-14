import type { Metadata } from "next";

import "../werkbank.css";

/**
 * Layout fuer die Admin-Routen. Setzt globale `noindex,nofollow`-Robots-
 * Meta, damit selbst wenn der geheime Pfad mal in einer Referer-Chain
 * landet, Crawler ihn nicht aufnehmen.
 *
 * `.wb` traegt die Werkbank-Tokens (admin.css): kuehles Grau, System-
 * schrift, eigene Farben. Ueberschreibt den dunklen `html`-Bg und die
 * Inter-Schrift aus globals.css, die fuer die Marketing-Site gelten.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="wb">{children}</div>;
}
