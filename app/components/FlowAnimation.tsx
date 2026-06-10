"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import desktopData from "../animations/animation-1-desktop.json";
import mobileData from "../animations/animation-1-mobile.json";

/**
 * Lottie wird Client-only geladen — lottie-web greift auf window/document zu,
 * also gibt's bei SSR-Render Errors. `dynamic` mit `ssr: false` schiebt das
 * Modul in einen Client-Bundle-Chunk; das Loading-State faellt auf den
 * Container-Hintergrund (cream/dark je nach FlowTab-Variante) zurueck.
 */
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const BREAKPOINT_PX = 960;

/**
 * Renders Animation 01 (Drag & drop import) inside the FlowTabs stage.
 * Picks the correct asset per breakpoint:
 *   - Desktop (>960 px): 520x650, 4:5 portrait — matcht .flow-stage exakt
 *   - Mobile  (≤960 px): 542x560, fast quadratisch — matcht das gleich
 *                        angepasste .flow-card-media aspect-ratio
 *
 * Respektiert prefers-reduced-motion: bei aktivem System-Flag wird Lottie
 * mit autoplay=false gerendert und auf Frame 0 pausiert. Lottie nutzt
 * `loop=true` damit die Animation bei der Desktop-Auto-Rotation immer
 * laeuft, statt mitten in den letzten Frame zu fallen.
 */
type FlowAnimationProps = {
  /**
   * Wenn false, pausiert die Animation auf Frame 0 — der Step ist sichtbar
   * aber nicht aktiv, also auch nicht spielend. Beim Desktop-Auto-Rotate
   * schaltet das Parent zwischen Steps und setzt diesen Prop entsprechend.
   */
  isActive: boolean;
};

export function FlowAnimation({ isActive }: FlowAnimationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  const animationData = isMobile ? mobileData : desktopData;

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
        animationData={animationData}
        loop
        autoplay={isActive && !reducedMotion}
        style={{ width: "100%", height: "100%" }}
        rendererSettings={{
          // SVG-Renderer ist scharf bei beliebiger Groesse; bei den knapp
          // 220 KB Asset-Groesse vs. Canvas ist der DOM-Footprint
          // vernachlaessigbar, aber die Visual-Qualitaet auf Retina ist
          // entscheidend besser.
          preserveAspectRatio: "xMidYMid meet",
        }}
      />
    </div>
  );
}
