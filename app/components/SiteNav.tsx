"use client";

import { useEffect, useState } from "react";
import { CalldayLogo } from "./CalldayLogo";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Notion-style sticky nav: transparent + light text while the dark
 * `.hero` is in view, frosted-light + dark text once the user has
 * scrolled past it. We toggle a `data-scrolled` attribute and let
 * globals.css handle the styling and the transition.
 *
 * Detection is a passive scroll listener that reads the hero's
 * bounding rect and flips state when its bottom edge crosses the
 * nav's bottom edge. We use a scroll listener (instead of an
 * IntersectionObserver) because IO turned out to be unreliable on
 * mobile Safari when the observed element has a negative top
 * margin — the dark hero sits with `margin-top: calc(-1 * (var
 * (--nav-h) + var(--hero-buffer)))`, and IO's intersection state
 * got stuck on "still intersecting" even well past the hero.
 *
 * The nav height is read from the CSS custom property `--nav-h` so
 * JS and stylesheet stay in sync. If there is no `.hero` on the
 * page (e.g. legal pages), we default to the scrolled state so the
 * nav stays readable on a light background.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Header-CTA je nach Login-Status: eingeloggte Rueckkehrer bekommen einen
  // Account-Link statt "Get early access". Client-seitig gecheckt, damit die
  // (statische) Landing-Page nicht dynamisch werden muss. getSession() liest
  // die Session aus dem Cookie ohne Netzwerk-Roundtrip — praktisch kein
  // Flackern; Default bleibt der ausgeloggte Zustand (99% der Besucher).
  useEffect(() => {
    let active = true;
    createSupabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setLoggedIn(!!data.session);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hero = document.querySelector(".hero");
    const nav = document.querySelector(".site-nav") as HTMLElement | null;
    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );

    // Bei einem Light-Hero (.hero-light) ist die Chrome-Tint immer
    // hell — nur der dunkle Hero braucht den dark→light-Flip der
    // theme-color beim Scrollen.
    const heroIsLight = hero?.classList.contains("hero-light") ?? true;

    // Helper: flip data-scrolled on the nav AND theme-color on the
    // meta tag atomically, then update React state. Doing this from
    // inside the scroll event handler (instead of via a
    // useEffect-after-commit) means the browser paints both DOM
    // changes in the same frame — important on iOS Safari, where the
    // status-bar overlay otherwise visibly lags the nav bg change by
    // a frame because React commits the attribute first and the
    // useEffect updates theme-color one tick later.
    const apply = (newScrolled: boolean) => {
      if (newScrolled) {
        nav?.setAttribute("data-scrolled", "true");
      } else {
        nav?.removeAttribute("data-scrolled");
      }
      themeMeta?.setAttribute(
        "content",
        newScrolled || heroIsLight ? "#faf9f5" : "#0d0f14"
      );
      setScrolled(newScrolled);
    };

    if (!hero) {
      apply(true);
      return;
    }
    // Read the nav's actual rendered height each scroll frame — the
    // CSS custom property --nav-h doesn't include the iOS
    // safe-area-inset-top, but the element's bounding rect does.
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
    <nav className="site-nav" data-scrolled={scrolled ? "true" : undefined}>
      <div className="container nav-inner">
        <div className="logo">
          <CalldayLogo size={32} />
          Callday
        </div>
        {loggedIn ? (
          <a href="/account" className="nav-cta">
            Account
          </a>
        ) : (
          <a href="#beta" className="nav-cta">
            Get early access
          </a>
        )}
      </div>
    </nav>
  );
}
