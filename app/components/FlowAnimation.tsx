"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LottieRefCurrentProps } from "lottie-react";
import desktop01 from "../animations/animation-1-desktop.json";
import mobile01 from "../animations/animation-1-mobile.json";
import desktop02 from "../animations/animation-2-desktop.json";
import mobile02 from "../animations/animation-2-mobile.json";
import desktop03 from "../animations/animation-3-desktop.json";
import mobile03 from "../animations/animation-3-mobile.json";

/**
 * Lottie wird Client-only geladen — lottie-web greift auf window/document zu,
 * also gibt's bei SSR-Render Errors. `dynamic` mit `ssr: false` schiebt das
 * Modul in einen Client-Bundle-Chunk; das Loading-State faellt auf den
 * Container-Hintergrund (cream/dark je nach FlowTab-Variante) zurueck.
 */
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const BREAKPOINT_PX = 960;

/**
 * Asset-Lookup per Step-Nummer. Pro Step zwei Varianten:
 *   - desktop: 520x650 (4:5 portrait) → matcht .flow-stage
 *   - mobile:  520x520 (1:1 square)   → matcht .flow-card-media[data-has-animation]
 *
 * Neue Animationen einfach hier eintragen + im FlowTabs-Step das
 * hasAnimation-Flag setzen.
 */
const ANIMATIONS: Record<
  string,
  { desktop: object; mobile: object }
> = {
  "01": { desktop: desktop01, mobile: mobile01 },
  "02": { desktop: desktop02, mobile: mobile02 },
  "03": { desktop: desktop03, mobile: mobile03 },
};

/**
 * Renders die richtige Lottie-Animation pro FlowTabs-Step:
 *   - Step 01 (Drag & drop import)
 *   - Step 02 (The calling loop)
 *   - Step 03 (Booked. Synced. Sent.)
 *
 * Picks die korrekte Asset-Variante per Breakpoint:
 *   - Desktop (>960 px): 520x650 4:5 portrait
 *   - Mobile  (≤960 px): 520x520 quadratisch
 *
 * Respektiert prefers-reduced-motion: bei aktivem System-Flag wird Lottie
 * mit autoplay=false gerendert und auf Frame 0 pausiert. Lottie nutzt
 * `loop=true` damit die Animation bei der Desktop-Auto-Rotation immer
 * laeuft, statt mitten in den letzten Frame zu fallen.
 */
type FlowAnimationProps = {
  /**
   * Step-Nummer als String (z.B. "01", "03"). Muss in ANIMATIONS gemappt
   * sein, sonst rendert die Komponente nichts. Steps ohne Asset bleiben
   * im FlowTabs auf hasAnimation: false und tragen weiter den
   * Text-Placeholder.
   */
  stepNum: string;
  /**
   * Wenn false, pausiert die Animation auf Frame 0 — der Step ist sichtbar
   * aber nicht aktiv, also auch nicht spielend. Beim Desktop-Auto-Rotate
   * schaltet das Parent zwischen Steps und setzt diesen Prop entsprechend.
   */
  isActive: boolean;
};

export function FlowAnimation({ stepNum, isActive }: FlowAnimationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const mqlBreakpoint = window.matchMedia(`(max-width: ${BREAKPOINT_PX}px)`);
    const mqlReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => {
      setIsMobile(mqlBreakpoint.matches);
      setReducedMotion(mqlReduced.matches);
    };
    sync();

    mqlBreakpoint.addEventListener("change", sync);
    mqlReduced.addEventListener("change", sync);
    return () => {
      mqlBreakpoint.removeEventListener("change", sync);
      mqlReduced.removeEventListener("change", sync);
    };
  }, []);

  /**
   * Imperatives Play/Pause via lottieRef.
   *
   * lottie-react re-initialisiert die Animation nicht zuverlaessig wenn
   * sich nur das `autoplay`-Prop aendert — Steps die mit isActive=false
   * mounten (z.B. Step 03 bei initialem activeIndex=0) wuerden bei der
   * spaeteren Carousel-Rotation stuck bleiben. Mit dem Ref steuern wir
   * play()/pause() direkt, sobald sich isActive aendert.
   *
   * Beim Pausieren auf Frame 0 zuruecksetzen, damit der nicht-aktive
   * Step nicht ein eingefrorenes Frame mittendrin zeigt waehrend der
   * Crossfade laeuft.
   */
  useEffect(() => {
    const inst = lottieRef.current;
    if (!inst) return;
    if (isActive && !reducedMotion) {
      inst.goToAndPlay(0, true);
    } else {
      inst.goToAndStop(0, true);
    }
  }, [isActive, reducedMotion]);

  const asset = ANIMATIONS[stepNum];
  if (!asset) return null;
  const animationData = isMobile ? asset.mobile : asset.desktop;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop
        autoplay={isActive && !reducedMotion}
        style={{ width: "100%", height: "100%" }}
        rendererSettings={{
          /**
           * SVG-Renderer statt Canvas: die Jitter-Exports fuer Animation 01
           * und 02 nutzen Track-Mattes (alpha masks) — lottie-web's
           * Canvas-Renderer rendert die nicht zuverlaessig (Animation 01
           * laedt gar nicht, 02 blinkt nur kurz). SVG ist ein bisschen
           * langsamer bei vielen Shapes, dafuer feature-complete.
           *
           * Falls die Performance in Prod nicht reicht, ist der naechste
           * Schritt @lottiefiles/dotlottie-react (Rust+WASM, schneller +
           * track-matte-fest), aber ~150 KB extra Bundle-Size.
           */
          preserveAspectRatio: "xMidYMid meet",
        }}
      />
    </div>
  );
}
