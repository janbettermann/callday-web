import Link from "next/link";
import type { Metadata } from "next";
import { CalldayLogo } from "./components/CalldayLogo";

/**
 * 404 Not Found-Page.
 *
 * Stilistisch matched die Page das Look-and-Feel der Legal-Pages —
 * gleicher Header, leichter Body, ein klarer Weg zurück.
 */

export const metadata: Metadata = {
  title: "Page not found · Callday",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
          background: "var(--bg)",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p
            style={{
              fontSize: 13,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            404
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.5px",
              color: "var(--ink)",
              marginBottom: 12,
            }}
          >
            We couldn&apos;t find that page.
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-dim)",
              marginBottom: 28,
            }}
          >
            The link may be outdated, or the page may have moved. Head back to
            the homepage — everything starts there.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "var(--blue)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "-0.1px",
            }}
          >
            Back to Callday
          </Link>
        </div>
      </main>
    </>
  );
}
