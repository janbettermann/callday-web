"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sprach-Toggle für die Legal-Pages. Wird im Article-Body direkt über
 * der H1 platziert (nicht in der Site-Nav), damit klar ist: das wechselt
 * NUR den Legal-Text, nicht die ganze Site.
 *
 * Routing-Konvention:
 *   /privacy       → EN (Default, US-Primärmarkt)
 *   /privacy/de    → DE
 *   /terms         → EN
 *   /terms/de      → DE
 *
 * Das `current`-Prop sagt der Component welcher Strang gerade rendert —
 * der jeweils andere wird zur Ziel-URL.
 */
interface LangToggleProps {
  current: "en" | "de";
}

function FlagUS() {
  return (
    <svg
      viewBox="0 0 24 16"
      width="18"
      height="12"
      aria-hidden="true"
      style={{ verticalAlign: "middle", marginRight: 6, borderRadius: 2 }}
    >
      <rect width="24" height="16" fill="#B22234" />
      <rect y="2.46" width="24" height="1.23" fill="#FFFFFF" />
      <rect y="4.92" width="24" height="1.23" fill="#FFFFFF" />
      <rect y="7.38" width="24" height="1.23" fill="#FFFFFF" />
      <rect y="9.84" width="24" height="1.23" fill="#FFFFFF" />
      <rect y="12.30" width="24" height="1.23" fill="#FFFFFF" />
      <rect y="14.76" width="24" height="1.23" fill="#FFFFFF" />
      <rect width="9.6" height="8.61" fill="#3C3B6E" />
    </svg>
  );
}

function FlagDE() {
  return (
    <svg
      viewBox="0 0 24 16"
      width="18"
      height="12"
      aria-hidden="true"
      style={{ verticalAlign: "middle", marginRight: 6, borderRadius: 2 }}
    >
      <rect width="24" height="5.33" fill="#000000" />
      <rect y="5.33" width="24" height="5.33" fill="#DD0000" />
      <rect y="10.66" width="24" height="5.33" fill="#FFCE00" />
    </svg>
  );
}

export function LangToggle({ current }: LangToggleProps) {
  const pathname = usePathname();

  // EN-URL ist immer der Pfad ohne trailing /de.
  const enUrl = pathname.replace(/\/de$/, "");
  // DE-URL haengt /de an die EN-URL an (ein /de an /privacy/de waere doppelt).
  const deUrl = `${enUrl}/de`;

  return (
    <div className="lang-toggle">
      <Link
        href={enUrl}
        className="lang-toggle-item"
        data-active={current === "en"}
        aria-current={current === "en" ? "true" : undefined}
        prefetch={false}
      >
        <FlagUS />
        EN
      </Link>
      <span className="lang-toggle-sep" aria-hidden="true">
        ·
      </span>
      <Link
        href={deUrl}
        className="lang-toggle-item"
        data-active={current === "de"}
        aria-current={current === "de" ? "true" : undefined}
        prefetch={false}
      >
        <FlagDE />
        DE
      </Link>
    </div>
  );
}
