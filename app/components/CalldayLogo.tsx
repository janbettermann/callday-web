/**
 * The Callday brand mark — blue rounded square with a horizon-arc and a
 * warm sun at center. Reused in the nav, footer and (legal)/auth headers.
 *
 * The base viewBox is 120×120; pass `size` to scale.
 */
export function CalldayLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="callday_bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7af7" />
          <stop offset="100%" stopColor="#3564e0" />
        </linearGradient>
        <radialGradient id="callday_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="callday_sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#callday_bg)" />
      <circle cx="60" cy="60" r="36" fill="url(#callday_glow)" />
      <path
        d="M 84.6 42.8 A 30 30 0 1 0 84.6 77.2"
        fill="none"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="12" fill="url(#callday_sun)" />
      <circle
        cx="60"
        cy="60"
        r="18"
        fill="none"
        stroke="rgba(251,191,36,0.25)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
