import Image from "next/image";

/**
 * iPhone-Mockup fuer die Hero — CSS-gerenderter Rahmen + echter
 * App-Screenshot als `next/image`.
 *
 * Warum kein fertiges Device-PNG mit eingebranntem Screen: ein
 * CSS-Rahmen bleibt auf jedem DPI knackscharf, spart ein zweites
 * Raster-Asset und laesst den Screenshot austauschen, ohne den Rahmen
 * neu zu bauen.
 *
 * Massverhaeltnisse: iPhone 15 Pro (Screen 393x852 pt). Bezel, Corner-
 * Radius und Dynamic Island skalieren proportional ueber die CSS-Var
 * `--phone-w` — Groesse aendern heisst also genau EINEN Wert aendern
 * (siehe `.phone`-Block in globals.css).
 *
 * Der Rahmen ist reine Dekoration (`aria-hidden`); die Bildbeschreibung
 * traegt der alt-Text am Screenshot.
 */
export function PhoneMockup({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  /** true fuer Above-the-fold — verhindert Lazy-Loading am LCP-Element. */
  priority?: boolean;
}) {
  return (
    <div className="phone">
      <div className="phone-glow" aria-hidden />
      <div className="phone-frame">
        <div className="phone-screen">
          {/*
            width/height = echte Pixelmasse der Quelldatei: 1179x2556, die
            native 3x-Aufloesung des iPhone 15 Pro. Ratio 0.4613 trifft
            393:852 exakt und deckt sich damit mit der aspect-ratio am
            `.phone-screen` — es wird nichts beschnitten. next/image
            reserviert daraus den Platz vor dem Laden (kein Layout-Shift);
            die sichtbare Groesse steuert allein `--phone-w` per CSS.
          */}
          <Image
            className="phone-shot"
            src={src}
            alt={alt}
            width={1179}
            height={2556}
            priority={priority}
            sizes="(max-width: 600px) 220px, (max-width: 960px) 250px, 320px"
          />
          {/*
            Synthetische Statusleiste — deckt die echte des Screenshots ab.
            Bewusst so gebaut statt "bitte sauberen Screenshot liefern":
            damit ist das Mockup asset-unabhaengig, jeder kuenftige
            Screenshot passt automatisch, egal bei welcher Uhrzeit oder
            welchem Akkustand er entstanden ist. `9:41` ist Apples
            Marketing-Konvention. Hintergrund = --phone-screen-bg, aus dem
            Screenshot gesampelt, damit keine Nahtkante entsteht.
          */}
          <div className="phone-statusbar" aria-hidden>
            <span className="phone-time">9:41</span>
            <span className="phone-status-icons">
              <svg viewBox="0 0 17 11" fill="currentColor">
                <rect x="0" y="7.5" width="3" height="3.5" rx="1" />
                <rect x="4.5" y="5.5" width="3" height="5.5" rx="1" />
                <rect x="9" y="3" width="3" height="8" rx="1" />
                <rect x="13.5" y="0" width="3" height="11" rx="1" />
              </svg>
              <svg viewBox="0 0 16 11" fill="currentColor">
                <path d="M8 10.6 6.1 8.4a2.9 2.9 0 0 1 3.8 0L8 10.6Z" />
                <path d="M8 5.6c1.4 0 2.7.5 3.7 1.4l1.2-1.4A8 8 0 0 0 8 3.6a8 8 0 0 0-4.9 2l1.2 1.4A5.4 5.4 0 0 1 8 5.6Z" />
                <path d="M8 1.4c2.2 0 4.3.8 5.9 2.2L15 2.2A10.5 10.5 0 0 0 8 0 10.5 10.5 0 0 0 1 2.2l1.1 1.4A8.8 8.8 0 0 1 8 1.4Z" />
              </svg>
              <svg viewBox="0 0 27 12" fill="none">
                <rect
                  x="0.5"
                  y="0.5"
                  width="22"
                  height="11"
                  rx="3.2"
                  stroke="currentColor"
                  strokeOpacity="0.35"
                />
                <rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" />
                <path
                  d="M24.6 4.3v3.4a1.9 1.9 0 0 0 0-3.4Z"
                  fill="currentColor"
                  fillOpacity="0.35"
                />
              </svg>
            </span>
          </div>

          <div className="phone-island" aria-hidden />
        </div>
      </div>
    </div>
  );
}
