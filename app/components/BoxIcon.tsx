/**
 * Isometrischer Box-Wuerfel fuer die "No CRM. No spreadsheet."-Karte im
 * Flinch-Grid (beide Landings — Sektion ist dupliziert, das Icon deshalb
 * geteilt). Ersetzt den Kreis-Haken: alles bleibt kompakt an einem Ort,
 * ohne Archiv-Deckel-Assoziation (Jan 2026-07-23).
 *
 * Stroke-Wuerfel im Stil der Nachbar-Icons (2px, runde Kappen) — Jans
 * Fill-basiertes "box (2).svg" wurde kurz probiert und zugunsten des
 * nativen Stroke-Stils wieder ersetzt (gleiche Motiv-Idee).
 */
export function BoxIcon() {
  return (
    <svg
      width={25}
      height={25}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3564e0"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1={12} y1={22.08} x2={12} y2={12} />
    </svg>
  );
}
