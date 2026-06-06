/**
 * Brand-Konstanten für Email-Templates. Werden inline gestyled (Standard
 * für Mail-Clients) — keine CSS-Variablen, keine externen Stylesheets.
 *
 * Source-of-Truth bleibt die Web-Brand (siehe app/globals.css). Hier
 * sind die Werte gespiegelt, weil Email-Clients keine var(--*) auflösen.
 */

export const brand = {
  blue: "#2563E8",
  text: "#1a1d23",
  textMuted: "#6b7280",
  // Matches landing-page --ink-faint = rgba(26,29,38,0.42) auf cream
  textFaint: "#9ea0a8",
  bg: "#ffffff",
  bgMuted: "#f8f9fb",
  border: "#e5e7eb",
} as const;

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif';

export const monoStack =
  'ui-monospace, "SF Mono", Monaco, Consolas, "Courier New", monospace';
