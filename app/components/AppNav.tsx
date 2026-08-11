"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalldayLogo } from "./CalldayLogo";
import { signOutAction } from "../account/actions";

/**
 * Gemeinsame Nav des eingeloggten Bereichs. Primaere Ziele (Orte) als
 * Tabs: Dashboard, Lists, Calldays. Die Listen-Generierung ist eine
 * Aktion, kein Ort — deshalb "New list" als prominenter Button rechts
 * (Jan-Entscheidung 2026-07-15, ersetzt den frueheren "Google Maps
 * scraper"-Tab). "Manage account" (Avatar) ganz rechts als Identitaet.
 *
 * Mobile (< 900px): der Header traegt links den Burger, rechts den Avatar
 * (kein Logo mehr — Jan 08/2026). Der "New list"-Button rutscht in ein
 * Slide-In-Panel von links (80% Screen-Breite, gecappt bei 380px), das ueber
 * den Header drueber liegt und den Hintergrund via Overlay dimmt. Als CTA
 * oben im Panel, gefolgt von den Nav-Items. Vier Close-Trigger: Overlay-Tap,
 * Close-X, Escape, Route-Change (Nav-Item-Tap navigiert und schliesst).
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

// Fortschritts-Ring um die Avatar-Pille: Radius/Umfang fuer die
// stroke-dasharray-Mathe. r=17.75 laesst um den 30px-Avatar (r15) einen
// schmalen Spalt zum 2.5px-Ring.
const RING_R = 17.75;
const RING_CIRC = 2 * Math.PI * RING_R;

export function AppNav({
  active,
  initial = "?",
}: {
  active: AppNavKey;
  initial?: string;
}) {
  const [open, setOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  // Credit-Stand fuer den Ring — client-seitig geladen, damit der Ring
  // ohne Prop-Threading auf jeder Seite erscheint (GET /api/credits ist
  // seiteneffektfrei). Fuellung = used/total.
  const [credits, setCredits] = useState<{
    used: number;
    total: number;
    balance: number;
  } | null>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.credits) {
          setCredits({
            used: data.credits.used,
            total: data.credits.total,
            balance: data.credits.balance,
          });
        }
      })
      .catch(() => {
        // Ring bleibt leer (nur Track) — kein harter Fehler im Header.
      });
    return () => {
      active = false;
    };
  }, []);

  const usedFraction =
    credits && credits.total > 0
      ? Math.min(1, Math.max(0, credits.used / credits.total))
      : 0;
  const ringOffset = RING_CIRC * (1 - usedFraction);

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
    setPopOpen(false);
  }, [pathname]);

  // Avatar-Popover: Escape schliesst, Klick ausserhalb schliesst. Getrennt
  // vom Slide-In-Panel — nur EIN Handler pro Effekt, damit der Cleanup
  // beim Toggle sauber ist.
  useEffect(() => {
    if (!popOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopOpen(false);
        avatarBtnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popRef.current?.contains(t)) return;
      if (avatarBtnRef.current?.contains(t)) return;
      setPopOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // pointerdown statt click: schliesst schon beim Runter-Klick, sonst
    // fuehrt ein Klick auf einen Link IM Popover manchmal zum Race mit
    // dem globalen click der genau vorher schliessen wuerde.
    window.addEventListener("pointerdown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
    };
  }, [popOpen]);

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
          {/* Burger sitzt seit 08/2026 im LINKEN Slot: auf Mobile links der
              Burger, rechts der Avatar, kein Logo (das entfaellt per CSS).
              Auf Desktop ist der Burger display:none — dort ankert das Logo
              weiter die Inline-Nav, unveraendert. */}
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
          {/* Avatar ganz rechts (Jan 2026-07-24): Identitaet sitzt am
              aeusseren Rand. Drumherum der Gold-Fortschritts-Ring
              (verbraucht/gesamt). Klick oeffnet ein Popover (Credits +
              Account + Sign out) statt direkt nach /account zu springen. */}
          <div className="appnav-account-wrap">
            <button
              ref={avatarBtnRef}
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={popOpen}
              aria-controls="appnav-pop"
              className={
                "appnav-account" + (active === "account" ? " is-active" : "")
              }
              onClick={() => setPopOpen((v) => !v)}
            >
              <span className="appnav-ring">
                <svg className="appnav-ring-svg" viewBox="0 0 40 40" aria-hidden="true">
                  <circle
                    className="appnav-ring-track"
                    cx="20"
                    cy="20"
                    r={RING_R}
                  />
                  <circle
                    className="appnav-ring-fill"
                    cx="20"
                    cy="20"
                    r={RING_R}
                    style={{
                      strokeDasharray: RING_CIRC,
                      strokeDashoffset: ringOffset,
                    }}
                  />
                </svg>
                <span className="appnav-avatar">{initial}</span>
              </span>
            </button>
            <AccountPopover
              open={popOpen}
              popRef={popRef}
              credits={credits}
            />
          </div>
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
        {/* Panel-CTA im App-Style (2026-08-12): weisser Grund, blaue
            Hairline, Sparkle in blauer Icon-Kachel links, Titel + Sub-
            Line rechts. 1:1 zum Generate-Card in der iOS-App (file.tsx
            im Import-Screen). Ohne Chevron rechts (Jan-Wahl). */}
        <Link
          href="/lists/new"
          className="appnav-panel-cta"
          onClick={closeMenu}
        >
          <span className="appnav-panel-cta-ic" aria-hidden="true">
            <SparkleIcon />
          </span>
          <span className="appnav-panel-cta-body">
            <span className="appnav-panel-cta-title">Generate a new list</span>
            <span className="appnav-panel-cta-sub">
              Scan Google for your ideal customers
            </span>
          </span>
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

/**
 * Avatar-Popover (Variante 02 „Sub-cards", 2026-08-12). Sitzt auf warmem
 * Grund, darin zwei kleine weisse Cards: 1) Lead credits — Ring + Zahlen
 * + Upgrade-Chip. 2) Menue — Account + Sign out (server action).
 * Bewusst KEIN „New list" hier: das ist eine Primaer-Aktion und lebt im
 * Header („Generate list") bzw. auf /lists. Dieses Menue ist Identitaet
 * + Status, keine zweite Nav.
 */
function AccountPopover({
  open,
  popRef,
  credits,
}: {
  open: boolean;
  popRef: React.RefObject<HTMLDivElement | null>;
  credits: { used: number; total: number; balance: number } | null;
}) {
  const remaining = credits?.balance ?? 0;
  const total = credits?.total ?? 0;
  const remainFmt = remaining.toLocaleString("en-US");
  const totalFmt = total.toLocaleString("en-US");

  return (
    <div
      id="appnav-pop"
      ref={popRef}
      role="menu"
      aria-label="Account menu"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      className={"appnav-pop" + (open ? " is-open" : "")}
    >
      <section className="appnav-pop-card">
        <div className="appnav-pop-credits-top">
          <div className="appnav-pop-credits-title">
            <span className="appnav-pop-credits-mark" aria-hidden="true" />
            <span>Lead credits</span>
          </div>
          <Link href="/account#credits" className="appnav-pop-upgrade">
            Upgrade
          </Link>
        </div>
        <dl className="appnav-pop-credits-grid">
          <dt>Plan</dt>
          <dd>{totalFmt}</dd>
          <dt>Remaining</dt>
          <dd>{remainFmt}</dd>
        </dl>
      </section>

      <section className="appnav-pop-card appnav-pop-menu">
        <Link href="/account" role="menuitem" className="appnav-pop-row">
          <svg className="appnav-pop-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          Account
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            role="menuitem"
            className="appnav-pop-row appnav-pop-row-danger"
          >
            <svg className="appnav-pop-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l-5-5 5-5" />
              <path d="M5 12h12" />
            </svg>
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
