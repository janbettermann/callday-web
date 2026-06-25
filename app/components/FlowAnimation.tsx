"use client";

import { useEffect, useRef, useState } from "react";

const BREAKPOINT_PX = 960;

/**
 * Asset-Lookup per Step-Nummer.
 *
 * Pro Step zwei Varianten:
 *   - desktop: 520x650 (4:5 portrait) → matcht .flow-stage
 *   - mobile:  520x520 (1:1 square)   → matcht .flow-card-media[data-has-animation]
 *
 * MP4 statt Lottie: hardware-decoded → smooth auch auf alten iPhones. Die
 * Lottie-Exporte stutterten dort weil lottie-web auf dem Main-Thread
 * rendert. Source-of-Truth fuer die Animation bleibt das Jitter-Projekt;
 * MP4-Exports liegen in public/animations/.
 *
 * Neue Animation: Eintrag hier ergaenzen + im FlowTabs-Step das
 * hasAnimation-Flag setzen.
 */
const ANIMATIONS: Record<string, { desktop: string; mobile: string }> = {
  "01": {
    desktop: "/animations/animation-1-desktop.mp4",
    mobile: "/animations/animation-1-mobile.mp4",
  },
  "02": {
    desktop: "/animations/animation-2-desktop.mp4",
    mobile: "/animations/animation-2-mobile.mp4",
  },
  "03": {
    desktop: "/animations/animation-3-desktop.mp4",
    mobile: "/animations/animation-3-mobile.mp4",
  },
};

/**
 * Renders die richtige Animation pro FlowTabs-Step:
 *   - Step 01 (Drag & drop import)
 *   - Step 02 (The calling loop)
 *   - Step 03 (Booked. Synced. Sent.)
 *
 * Picks die korrekte Asset-Variante per Breakpoint:
 *   - Desktop (>960 px): 520x650 4:5 portrait
 *   - Mobile  (≤960 px): 520x520 quadratisch
 *
 * Respektiert prefers-reduced-motion: bei aktivem System-Flag wird das
 * Video auf Frame 0 pausiert. Sonst loop=true damit die Animation bei der
 * Desktop-Auto-Rotation immer laeuft, statt mitten im letzten Frame zu
 * hängen.
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

  const asset = ANIMATIONS[stepNum];
  if (!asset) return null;
  const src = isMobile ? asset.mobile : asset.desktop;

  return (
    <VideoStage src={src} isActive={isActive} reducedMotion={reducedMotion} />
  );
}

/**
 * MP4-Backend. Hardware-decoded → smooth auch auf alten iPhones, fixt das
 * Stutter-Problem das wir mit Lottie hatten.
 *
 * Wichtige Attribute fuer iOS Safari:
 *   - muted        → Pflicht fuer Autoplay (Browser-Policy)
 *   - playsInline  → ohne reisst iOS das Video in Fullscreen
 *   - preload="metadata" → laedt nur den Header initial, full payload erst
 *                          beim Play. Halbiert initial-load fuer Steps die
 *                          beim Mount inaktiv sind.
 *   - disablePictureInPicture → kein PiP-Button im Long-Press-Menue
 *
 * `key={src}` forciert Re-Mount wenn der Breakpoint vom Resize wechselt
 * (Mobile↔Desktop). Ohne den Key wuerde das Video weiter aus dem alten
 * Asset-Buffer spielen.
 *
 * Play/Pause via Ref damit isActive-Aenderungen ohne Re-Render greifen.
 * `void play().catch()` schluckt den Autoplay-Reject (kann auftreten wenn
 * der Browser unmuted-policy hinzufuegt) — dann bleibt das Video einfach
 * auf Frame 0 stehen statt Console-Errors zu werfen.
 */
function VideoStage({
  src,
  isActive,
  reducedMotion,
}: {
  src: string;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !reducedMotion) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, reducedMotion, src]);

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
      <video
        key={src}
        ref={videoRef}
        src={src}
        autoPlay={isActive && !reducedMotion}
        muted
        playsInline
        loop
        preload="metadata"
        disablePictureInPicture
        aria-hidden
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
