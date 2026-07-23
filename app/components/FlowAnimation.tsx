"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Asset-Lookup per Step-Nummer.
 *
 * Seit dem V1-Redesign (3-Karten-Raster, 2026-07-23) sind BEIDE Varianten
 * quadratische 1:1-Exports — der Unterschied ist nicht das Format, sondern
 * das TIMING (Jan-Entscheidung 2026-07-23):
 *   - desktop: Sequenz-Timing fuer die Staffel (Karte spielt einmal durch
 *     und uebergibt — Szenenwechsel entsprechend getaktet).
 *   - mobile:  Loop-Timing fuer den Mobile-Stack (Karte loopt endlos,
 *     solange sie im Viewport steht).
 * Die frueheren 4:5-Portrait-Exports sind nicht mehr im Repo (Git-History
 * hat sie); ein kuenftiges Hochformat-Layout braucht neue Exports.
 *
 * MP4 statt Lottie: hardware-decoded → smooth auch auf alten iPhones. Die
 * Lottie-Exporte stutterten dort weil lottie-web auf dem Main-Thread
 * rendert. Source-of-Truth fuer die Animation bleibt das Jitter-Projekt.
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
 * Respektiert prefers-reduced-motion: bei aktivem System-Flag laeuft
 * nichts automatisch — der User kann die Animation aber ueber den
 * Play-Toggle bewusst starten (die WCAG-konforme Ausnahme: deliberate
 * user request schlaegt das System-Flag). Die Desktop-Staffel startet
 * dann ebenfalls nicht (kein Autoplay → kein `ended`).
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
   * Welche Timing-Variante des Assets spielt (beide 1:1, s. ANIMATIONS):
   * das Desktop-Raster uebergibt "desktop", der Mobile-Stack "mobile".
   * Bewusst expliziter Prop statt matchMedia — die beiden Breakpoint-
   * Trees sind eh getrennte DOM-Baeume, jeder kennt seine Variante.
   */
  variant: "desktop" | "mobile";
  /**
   * Wenn false, pausiert die Animation auf Frame 0 — der Step ist sichtbar
   * aber nicht aktiv, also auch nicht spielend. Auf Desktop setzt die
   * Staffel-Logik in FlowTabs diesen Prop, auf Mobile die per-Karte-
   * Viewport-Beobachtung.
   */
  isActive: boolean;
  /**
   * Default true (Mobile-Karten loopen endlos). Die Desktop-Staffel
   * schaltet loop nur im Hover-Modus an — ohne loop feuert `ended` und
   * uebergibt an die naechste Karte.
   */
  loop?: boolean;
  /** Feuert am natuerlichen Video-Ende (nur ohne loop relevant). */
  onEnded?: () => void;
};

export function FlowAnimation({
  stepNum,
  variant,
  isActive,
  loop = true,
  onEnded,
}: FlowAnimationProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const src = ANIMATIONS[stepNum]?.[variant];
  if (!src) return null;

  return (
    <VideoStage
      src={src}
      isActive={isActive}
      reducedMotion={reducedMotion}
      loop={loop}
      onEnded={onEnded}
    />
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
 * `key={src}` forciert Re-Mount, falls sich das Asset eines Steps je
 * aendert (seit dem Square-only-Setup ist src pro Step konstant — der
 * Key ist dann ein No-Op und bleibt als Schutz stehen).
 *
 * Blockiertes Autoplay heilt sich selbst: Frueher wurde ein abgelehntes
 * `play()` still geschluckt — war beim ersten Versuch z.B. der iOS-
 * Stromsparmodus aktiv, blieb das Video bis zum naechsten harten Reload
 * auf Frame 0 eingefroren (Beta-Report 2026-07-22, iPhone 12 Pro).
 * Jetzt wird nach einer Ablehnung bei der naechsten User-Geste
 * (Scroll/Touch/Klick/Taste) und beim Tab-Foreground erneut versucht —
 * eine echte Geste darf Video-Play in praktisch jeder Policy.
 *
 * Dazu der immer sichtbare Play/Pause-Toggle (Apple-Muster, WCAG 2.2.2:
 * auto-abspielende Inhalte > 5s brauchen einen wahrnehmbaren Pausier-
 * Mechanismus). Er ist zugleich die letzte Verteidigungslinie gegen
 * jede Autoplay-Blockade: play() innerhalb einer Klick-Geste ist immer
 * erlaubt. Bei prefers-reduced-motion startet er die Animation bewusst —
 * deliberate request schlaegt das System-Flag.
 */
function VideoStage({
  src,
  isActive,
  reducedMotion,
  loop,
  onEnded,
}: {
  src: string;
  isActive: boolean;
  reducedMotion: boolean;
  loop: boolean;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Expliziter User-Wunsch vom Toggle, ueberlagert die Automatik:
   *   "pause" → kein Auto-Resume, bis der User wieder startet
   *   "play"  → spielt auch bei reduced-motion (bewusster Start)
   *   null    → Automatik (aktiv + kein reduced-motion → spielen)
   */
  const [userIntent, setUserIntent] = useState<"play" | "pause" | null>(null);
  /** Echter Video-Zustand fuers Toggle-Icon, gespeist aus play/pause-Events. */
  const [isPlaying, setIsPlaying] = useState(false);

  const wantsPlay =
    isActive && userIntent !== "pause" && (userIntent === "play" || !reducedMotion);
  // Ref-Spiegel fuer die asynchronen Retry-Callbacks: deren Closures
  // wuerden sonst den Stand vom Zeitpunkt der Registrierung sehen.
  const wantsPlayRef = useRef(wantsPlay);
  wantsPlayRef.current = wantsPlay;

  // Ein expliziter Play-Wunsch gilt nur fuer den aktuellen Auftritt der
  // Karte. Verlaesst sie den Viewport, faellt die Automatik zurueck auf
  // ihre Regeln — ein Reduced-Motion-User soll beim Wiederreinscrollen
  // nicht ungefragt weiterlaufende Videos bekommen. "pause" bleibt
  // dagegen stehen: wer pausiert hat, will kein Auto-Resume.
  useEffect(() => {
    if (!isActive) setUserIntent((u) => (u === "play" ? null : u));
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    setIsPlaying(!v.paused);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
    // key={src} remountet das <video> — der Listener-Satz muss mitziehen.
  }, [src]);

  const retryCleanupRef = useRef<(() => void) | null>(null);
  const clearRetry = useCallback(() => {
    retryCleanupRef.current?.();
    retryCleanupRef.current = null;
  }, []);

  /**
   * play() mit Selbstheilung: Lehnt der Browser ab (Stromspar-/Daten-
   * sparmodus, sonstige Policy), warten One-Shot-Listener auf die
   * naechste User-Geste bzw. den Tab-Foreground und versuchen es genau
   * dann erneut — sofern die Karte dann noch spielen will. Kein Loop-
   * Risiko: jeder Retry haengt an einem diskreten Ereignis.
   */
  const attemptPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    clearRetry();
    v.play().catch(() => {
      const retry = () => {
        clearRetry();
        if (wantsPlayRef.current) attemptPlay();
      };
      const onVisibility = () => {
        if (!document.hidden) retry();
      };
      window.addEventListener("pointerdown", retry, { passive: true });
      window.addEventListener("touchstart", retry, { passive: true });
      window.addEventListener("scroll", retry, { passive: true });
      window.addEventListener("keydown", retry);
      document.addEventListener("visibilitychange", onVisibility);
      retryCleanupRef.current = () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("touchstart", retry);
        window.removeEventListener("scroll", retry);
        window.removeEventListener("keydown", retry);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    });
  }, [clearRetry]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (wantsPlay) {
      attemptPlay();
    } else {
      clearRetry();
      v.pause();
      // Nur beim Verlassen der Karte auf Anfang zurueck — die Story
      // startet beim naechsten Auftritt von vorn. Eine User-Pause
      // friert dagegen den aktuellen Frame ein (Resume statt Restart).
      if (!isActive) v.currentTime = 0;
    }
    return clearRetry;
  }, [wantsPlay, isActive, src, attemptPlay, clearRetry]);

  const onToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      setUserIntent("pause");
      v.pause();
    } else {
      setUserIntent("play");
      clearRetry();
      // Direkt IN der Klick-Geste spielen — das erlaubt jede Policy,
      // unabhaengig davon was der Automatik vorher verboten wurde.
      void v.play().catch(() => {});
    }
  };

  return (
    <div
      style={{
        position: "relative",
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
        loop={loop}
        onEnded={onEnded}
        preload="metadata"
        disablePictureInPicture
        aria-hidden
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      <button
        type="button"
        className="flow-video-toggle"
        // Fuer den CSS-Zustand "laeuft gerade": Mobile blendet den Toggle
        // dann fast weg — solange das Video steht (z.B. blockiertes
        // Autoplay), bleibt er dagegen klar sichtbar, das ist sein
        // Rettungsanker-Job.
        data-playing={isPlaying || undefined}
        aria-label={isPlaying ? "Pause animation" : "Play animation"}
        onClick={onToggle}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3.2 1.9c0-.78.85-1.26 1.52-.86l6.06 3.6c.65.39.65 1.34 0 1.73l-6.06 3.6c-.67.4-1.52-.08-1.52-.86V1.9Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
