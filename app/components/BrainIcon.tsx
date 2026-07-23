/**
 * Gehirn-Icon fuer die "Rewards the dial, not the close."-Karte im
 * Flinch-Grid (beide Landings — Sektion ist dupliziert, das Icon
 * deshalb geteilt). Von Jan geliefertes Asset (Downloads/"brain (2).svg",
 * 2026-07-23; von drei Kandidaten der einzige im Stroke-Stil der
 * Nachbar-Icons). Ersetzt das fruehere Puls-Polyline-Motiv — die Karte
 * ist die Psychologie-Karte ("Your brain learns to crave the dial").
 *
 * Umstyling gegenueber dem Original: Stroke schwarz -> Icon-Blau,
 * Strichstaerke 30 -> 42 (entspricht bei der grossen ViewBox optisch
 * den 2px der 24er-Nachbar-Icons).
 */
export function BrainIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 511.556 511.556"
      fill="none"
      stroke="#3564e0"
      strokeWidth={42}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M122.85,430.812c-35.685,0-65.78-28.579-65.78-63.713c0-15.35,5.523-29.429,14.717-40.419C39.796,322.873,15,296.068,15,263.543c0-34.18,27.379-62.054,61.72-63.545c-8.994-10.931-14.391-24.848-14.391-40.01c0-35.135,29.025-63.63,64.71-63.63c-0.364-2.735-0.552-5.524-0.552-8.356c0-35.135,28.928-63.617,64.612-63.617s64.613,28.482,64.613,63.617h0.001h0.074v333.392c0,36.328-29.911,65.779-66.808,65.779C155.329,487.172,127.491,462.678,122.85,430.812z" />
      <path d="M123.361,205.894c27.846,0,50.419,22.226,50.419,49.642c0,27.417-22.573,49.642-50.419,49.642" />
      <path d="M127.039,96.357c3.995,29.979,30.043,53.122,61.58,53.122" />
      <path d="M122.85,430.812c-0.448-3.076-0.68-6.22-0.68-9.418c0-36.328,29.911-65.779,66.808-65.779" />
      <path d="M255.77,421.394c0,36.328,29.911,65.779,66.808,65.779c33.649,0,61.488-24.494,66.128-56.361c35.685,0,65.78-28.579,65.78-63.713c0-15.35-5.523-29.429-14.717-40.419c31.991-3.806,56.787-30.611,56.787-63.136c0-34.18-27.379-62.054-61.72-63.545c8.994-10.931,14.391-24.848,14.391-40.01c0-35.135-29.025-63.63-64.71-63.63c0.364-2.735,0.552-5.524,0.552-8.356c0-35.135-28.928-63.617-64.613-63.617s-64.612,28.482-64.612,63.617h-0.001h-0.074" />
      <path d="M388.195,205.894c-27.846,0-50.419,22.226-50.419,49.642c0,27.417,22.573,49.642,50.419,49.642" />
      <path d="M384.518,96.357c-3.995,29.979-30.043,53.122-61.58,53.122" />
      <path d="M388.706,430.812c0.448-3.076,0.68-6.22,0.68-9.418c0-36.328-29.911-65.779-66.808-65.779" />
    </svg>
  );
}
