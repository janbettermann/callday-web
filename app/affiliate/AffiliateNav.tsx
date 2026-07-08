"use client";

import { useState } from "react";
import Link from "next/link";

import { CalldayLogo } from "../components/CalldayLogo";
import { affiliateSignOutAction } from "./dashboard/actions";

const LINKS = [
  { href: "/affiliate/dashboard", label: "Dashboard" },
  { href: "/affiliate/posts", label: "Posts" },
  { href: "/affiliate/activity", label: "Activity" },
  { href: "/affiliate/payouts", label: "Payouts" },
  { href: "/affiliate/settings", label: "Settings" },
  { href: "/affiliate/agreement", label: "Agreement" },
];

const itemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: "11px 16px",
  fontSize: 15,
  fontWeight: 500,
  color: "var(--ink)",
  textDecoration: "none",
  cursor: "pointer",
  borderRadius: 10,
  fontFamily: "inherit",
};

/**
 * „Affiliate"-Badge neben dem Logo. Nutzt die Mono-Caps-Label-Sprache der
 * Seite (wie „YOUR LINK") plus einen dezenten Brand-Blau-Tint — passt auf den
 * hellen (data-scrolled) Nav-Grund, ohne wie ein CTA zu wirken.
 */
const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 100,
  background: "rgba(53, 100, 224, 0.1)",
  border: "0.5px solid rgba(53, 100, 224, 0.22)",
  color: "var(--blue-deep)",
  fontFamily: "var(--font-label)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  lineHeight: 1,
};

/**
 * Globale Affiliate-Navigation (Hamburger). Auf allen /affiliate/*-Seiten.
 * Bei 4 Zielen (Dashboard/Posts/Activity/Agreement) waeren sichtbare Tabs auf
 * Mobile zu eng — ein Menue ist die saubere Wahl und skaliert. Sign out liegt
 * hier (eine Stelle), nicht mehr im Dashboard-Header.
 */
export function AffiliateNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="site-nav" data-scrolled="true">
      <div className="container nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/affiliate/dashboard"
            className="logo"
            style={{ textDecoration: "none" }}
          >
            <CalldayLogo size={32} />
            Callday
          </Link>
          <span style={pillStyle}>Affiliate</span>
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 5,
              width: 40,
              height: 40,
              padding: 9,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span aria-hidden style={barStyle(open, 0)} />
            <span aria-hidden style={barStyle(open, 1)} />
            <span aria-hidden style={barStyle(open, 2)} />
          </button>

          {open ? (
            <>
              <div
                onClick={() => setOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 1 }}
              />
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  zIndex: 2,
                  minWidth: 200,
                  background: "#ffffff",
                  border: "0.5px solid var(--line)",
                  borderRadius: 14,
                  boxShadow: "0 12px 32px rgba(26,29,38,0.12)",
                  padding: 6,
                }}
              >
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    style={itemStyle}
                  >
                    {l.label}
                  </Link>
                ))}
                <div
                  style={{
                    borderTop: "0.5px solid var(--line)",
                    margin: "6px 0",
                  }}
                />
                <form action={affiliateSignOutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    style={{ ...itemStyle, color: "var(--ink-dim)" }}
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

function barStyle(open: boolean, i: number): React.CSSProperties {
  return {
    display: "block",
    height: 2,
    width: 22,
    borderRadius: 2,
    background: "var(--ink)",
    transition: "transform 0.2s, opacity 0.2s",
    transform: open
      ? i === 0
        ? "translateY(7px) rotate(45deg)"
        : i === 2
          ? "translateY(-7px) rotate(-45deg)"
          : "none"
      : "none",
    opacity: open && i === 1 ? 0 : 1,
  };
}
