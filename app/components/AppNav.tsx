"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalldayLogo } from "./CalldayLogo";

/**
 * Gemeinsame Nav des eingeloggten Bereichs. Primaere Ziele (Orte) als
 * Tabs: Dashboard, Lists, Calldays. Die Listen-Generierung ist eine
 * Aktion, kein Ort — deshalb "New list" als prominenter Button rechts
 * (Jan-Entscheidung 2026-07-15, ersetzt den frueheren "Google Maps
 * scraper"-Tab). "Manage account" (Avatar) ganz rechts als Identitaet.
 *
 * Mobile (< 900px): der Header traegt nur noch Logo, Burger und Avatar.
 * Der "New list"-Button rutscht in ein Slide-In-Panel von rechts (90%
 * Screen-Breite, gecappt bei 380px), das ueber den Header drueber liegt
 * und den Hintergrund via Overlay dimmt. Als CTA oben im Panel, gefolgt
 * von den Nav-Items. Vier Close-Trigger: Overlay-Tap, Close-X, Escape,
 * Route-Change (Nav-Item-Tap navigiert und schliesst).
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

/**
 * Sparkle-Icon (4-Punkt-Stern, filled) — visueller Anker fuer das
 * Generate-Feature ueber App + Web. Matched das `SparklesIcon` in
 * `app/(tabs)/listen/import/file.tsx` in der iOS-App.
 * Auf dem Desktop-Header-Button in Brand-Blau (Design-B, 2026-07-26):
 * weisser Grund + blauer Sparkle als Marken-Anker; im Slide-In-Panel-CTA
 * (Mobile) auf schwarzem Grund weiss — nur der Icon-Shape ist geteilt.
 */
function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
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
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const closeMenu = useCallback(() => {
    setOpen(false);
    // Focus-Return zum Burger fuer Keyboard/Screen-Reader-User. setTimeout(0)
    // damit React den State-Flip erst rendert bevor wir focussen — sonst
    // koennte der Burger noch das inaktive Aussehen haben. Bei Route-Change
    // ist der Burger ggf. gar nicht mehr im DOM (AppNav remountet); dann
    // schlaegt focus() still fehl, focus wandert an body. Kein Bug.
    setTimeout(() => burgerRef.current?.focus(), 0);
  }, []);

  // Escape schliesst. Listener nur registriert wenn offen — spart einen
  // dead global keydown im Ruhezustand.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeMenu]);

  // Body-Scroll-Lock. Ohne dies scrollt der Hintergrund mit wenn der User
  // im Panel scrollt (Scroll-Chain in iOS Safari besonders auffaellig).
  // Vorigen Wert merken damit ein anderer Modal-Lock nicht ueberschrieben
  // wird — realistisch gibt's aktuell keinen, aber defensiv billig.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Route-Change schliesst. Feuert auch beim initial Mount (pathname ist
  // immer gesetzt), aber setOpen(false) ist dann ein No-Op weil der State
  // ohnehin false ist.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Focus auf den Close-Button beim Oeffnen. Timeout gibt der Slide-In-
  // Animation Zeit zu starten bevor der Focus-Ring erscheint — sonst
  // sieht man den Focus-Ring am linken Rand aufblitzen bevor das Panel
  // ganz drin ist.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panelCloseRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

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
            <SparkleIcon />
            Generate list
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className="appnav-burger"
            aria-expanded={open}
            aria-controls="appnav-panel"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
          {/* Avatar ganz rechts — auch rechts vom Burger (Jan 2026-07-24):
              Identitaet sitzt am aeusseren Rand, die blaue Pille markiert
              sie als das eine Marken-Element im Header. */}
          <Link
            href="/account"
            aria-label="Manage account"
            className={
              "appnav-account" + (active === "account" ? " is-active" : "")
            }
          >
            <span className="appnav-avatar">{initial}</span>
          </Link>
        </div>
      </div>

      {/* Slide-In-Panel + Overlay. Immer im DOM (kein conditional mount),
          damit die CSS-Transform-Animation beim Oeffnen/Schliessen greift.
          `inert` (React-19-Prop) macht die Elemente im geschlossenen
          Zustand nicht tabbable und nicht klickbar — sauberer als
          aria-hidden allein, das nur AT-Layer wirkt. */}
      <div
        className={"appnav-overlay" + (open ? " is-open" : "")}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <aside
        id="appnav-panel"
        className={"appnav-panel" + (open ? " is-open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <button
          ref={panelCloseRef}
          type="button"
          className="appnav-panel-close"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
        <Link
          href="/lists/new"
          className="appnav-panel-cta"
          onClick={closeMenu}
        >
          <PlusIcon />
          Generate list
        </Link>
        <div className="appnav-panel-divider" role="presentation" />
        <div className="appnav-panel-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                "appnav-panel-item" + (active === item.key ? " is-active" : "")
              }
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/account"
            className={
              "appnav-panel-item" + (active === "account" ? " is-active" : "")
            }
            onClick={closeMenu}
          >
            Account
          </Link>
        </div>
      </aside>
    </nav>
  );
}
