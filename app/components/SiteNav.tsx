"use client";

import { useEffect, useState } from "react";
import { CalldayLogo } from "./CalldayLogo";

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

  useEffect(() => {
    const hero = document.querySelector(".hero");
    if (!hero) {
      setScrolled(true);
      return;
    }
    // Read the nav's actual rendered height each scroll frame — the
    // CSS custom property --nav-h doesn't include the iOS
    // safe-area-inset-top, but the element's bounding rect does.
    const nav = document.querySelector(".site-nav") as HTMLElement | null;
    const onScroll = () => {
      const navH = nav?.getBoundingClientRect().height ?? 72;
      // setState bails when the value is unchanged, so this is cheap
      // even at 60 fps.
      setScrolled(hero.getBoundingClientRect().bottom <= navH);
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
        <a href="#beta" className="nav-cta">
          Apply for beta
        </a>
      </div>
    </nav>
  );
}
