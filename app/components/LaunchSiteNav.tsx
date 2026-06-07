"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalldayLogo } from "./CalldayLogo";

/**
 * Launch-Version der Sticky-Nav für die Public-Launch-Landing.
 *
 * Spiegelt die Scroll-Detection-Logik von SiteNav.tsx (das ist die Beta-
 * Variante), unterscheidet sich aber im Nav-Content:
 *   - SiteNav (Beta):    Logo-div + "Get early access"-CTA (zu #beta)
 *   - LaunchSiteNav:     Logo als Link + "Sign in"/"Account" + "Get Callday"-CTA
 *
 * Warum ein eigener Component statt SiteNav mit Props: Beta- und Launch-
 * Nav driften vermutlich weiter auseinander (Launch kriegt evtl.
 * "Pricing"-Anchor, Testimonials-Link, etc.), und das Branch-Strategy-
 * Memo bevorzugt explizit eigenständige Files pro Branch über frühe
 * Abstraktion via Props. Wartungs-Disziplin: wenn beide Navs nach
 * mehreren Iterationen DOCH konvergieren, refactor-fähig zusammenführen.
 *
 * Detection-Pattern: passive Scroll-Listener auf window, der das Hero-
 * Element via querySelector zieht und beim Bottom-Cross-Punkt das
 * `data-scrolled`-Attribut atomar mit der theme-color-Meta-Tag flippt.
 * Atomar (innerhalb desselben Frame) ist wichtig für iOS-Safari-Status-
 * bar-Sync — siehe Comment-Block in SiteNav.tsx für die Hintergrund-
 * Begründung.
 */
export function LaunchSiteNav({ isAuthed }: { isAuthed: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".hero");
    const nav = document.querySelector(".site-nav") as HTMLElement | null;
    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );

    const apply = (newScrolled: boolean) => {
      if (newScrolled) {
        nav?.setAttribute("data-scrolled", "true");
      } else {
        nav?.removeAttribute("data-scrolled");
      }
      themeMeta?.setAttribute(
        "content",
        newScrolled ? "#faf9f5" : "#0d0f14"
      );
      setScrolled(newScrolled);
    };

    if (!hero) {
      apply(true);
      return;
    }
    const onScroll = () => {
      const navH = nav?.getBoundingClientRect().height ?? 72;
      apply(hero.getBoundingClientRect().bottom <= navH);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav
      className="site-nav"
      data-scrolled={scrolled ? "true" : undefined}
    >
      <div className="container nav-inner">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <CalldayLogo size={32} />
          Callday
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <Link
            href={isAuthed ? "/account" : "/login"}
            style={{
              color: "var(--ink-dim)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {isAuthed ? "Account" : "Sign in"}
          </Link>
          <a href="#pricing" className="nav-cta">
            Get Callday
          </a>
        </div>
      </div>
    </nav>
  );
}
