"use client";

import { useState } from "react";
import Link from "next/link";
import { CalldayLogo } from "./CalldayLogo";

/**
 * Gemeinsame Nav des eingeloggten Bereichs. Primaere Ziele (Orte) als
 * Tabs: Dashboard, Lists, Calldays. Die Listen-Generierung ist eine
 * Aktion, kein Ort — deshalb "New list" als prominenter Button rechts
 * (Jan-Entscheidung 2026-07-15, ersetzt den frueheren "Google Maps
 * scraper"-Tab). "Manage account" (Avatar) ganz rechts als Identitaet.
 * Unter 900px klappen die Tabs ins Hamburger-Menue; Button + Pille
 * bleiben sichtbar.
 *
 * Sitzt im bestehenden `.site-nav`-Shell (fixed, --nav-h, safe-area).
 */

export type AppNavKey =
  | "dashboard"
  | "lists"
  | "calldays"
  | "account"
  | "new";

const NAV_ITEMS: { key: AppNavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "lists", label: "Lists", href: "/lists" },
  { key: "calldays", label: "Calldays", href: "/calldays" },
];

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function AppNav({
  active,
  initial = "?",
}: {
  active: AppNavKey;
  initial?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="site-nav appnav" data-scrolled="true">
      <div className="container nav-inner appnav-inner">
        <div className="appnav-left">
          <Link
            href="/dashboard"
            className="logo"
            aria-label="Callday — Dashboard"
            style={{ textDecoration: "none" }}
          >
            <CalldayLogo size={32} />
          </Link>
          <div className="appnav-links">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={
                  "appnav-link" + (active === item.key ? " is-active" : "")
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="appnav-right">
          <Link href="/lists/new" className="appnav-new-btn">
            <PlusIcon />
            New list
          </Link>
          <Link
            href="/account"
            aria-label="Manage account"
            className={
              "appnav-account" + (active === "account" ? " is-active" : "")
            }
          >
            <span className="appnav-avatar">{initial}</span>
          </Link>
          <button
            type="button"
            className="appnav-burger"
            aria-expanded={open}
            aria-controls="appnav-mobile"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        <nav
          id="appnav-mobile"
          className={"appnav-mobile" + (open ? " is-open" : "")}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                "appnav-mobile-link" + (active === item.key ? " is-active" : "")
              }
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/account"
            className={
              "appnav-mobile-link" + (active === "account" ? " is-active" : "")
            }
            onClick={() => setOpen(false)}
          >
            Manage account
          </Link>
        </nav>
      </div>
    </nav>
  );
}
