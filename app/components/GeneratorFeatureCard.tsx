/**
 * Breite Generator-Karte als Auftakt des Feature-Grids ("Built to fight
 * the flinch") — geteilt zwischen organic Landing (app/page.tsx) und
 * Affiliate-Landing (/a/[slug]).
 *
 * Positionierung ist bewusst Flinch-Framing, kein Feature-Announcement:
 * "keine Liste haben" ist die erste Prokrastinations-Luecke, vor den
 * vier Gewohnheits-Karten. Das Mini-Visual (Toolbar mit Chips +
 * "Generate list"-Button, darunter Lead-Zeilen) ist ein stilisiertes
 * Produkt-UI (Jan-Entscheidung 2026-07-23, Variante 3): Button-Label
 * bewusst generisch "Generate list" — der echte /lists/new-Button heisst
 * "Build my list", das Panel ist Symbolbild, kein Screenshot. Bewusst
 * ohne eigenen Link (2026-07-23 wieder entfernt) — die Karte informiert,
 * Conversion laeuft ueber Hero-CTA und Big-CTA (#signup).
 */
export function GeneratorFeatureCard() {
  return (
    <div className="feature-card feature-card-wide">
      <div className="feature-card-wide-copy">
        <div className="feature-icon">
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3564e0"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16" />
            <path d="M4 11h9" />
            <path d="M4 17h6" />
            <circle cx={17} cy={16} r={3.5} />
            <path d="M19.6 18.6 22 21" />
          </svg>
        </div>
        <h3>No list? No excuse.</h3>
        <p>
          Type an industry and a city. Callday builds a call-ready lead
          list for you — phone numbers, websites, ratings. Your first
          list is free.
        </p>
      </div>

      <div className="feature-gen-visual" aria-hidden="true">
        <div className="feature-gen-toolbar">
          <div className="feature-gen-chips">
            <span className="feature-gen-chip">Dentists</span>
            <span className="feature-gen-chip">Cologne</span>
          </div>
          <span className="feature-gen-btn">
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1={12} y1={15} x2={12} y2={3} />
            </svg>
            Generate list
          </span>
        </div>
        <div className="feature-gen-lead">
          <GoogleGlyph />
          <span className="feature-gen-bar" style={{ flexGrow: 1 }} />        </div>
        <div className="feature-gen-lead">
          <GoogleGlyph />
          <span className="feature-gen-bar" style={{ flexGrow: 0.72 }} />        </div>
        <div className="feature-gen-lead">
          <GoogleGlyph />
          <span className="feature-gen-bar" style={{ flexGrow: 0.88 }} />        </div>
      </div>
    </div>
  );
}

/* Offizielles 4-Farben-Google-G am Anfang jeder Lead-Zeile — exakt die
   Pfade aus der App (components/shared/GoogleGIcon.tsx, Google-My-
   Business-Pill der Pre-Call-Card). Bei Aenderungen dort hier nachziehen. */
function GoogleGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 18 18"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.61z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A8.99 8.99 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
