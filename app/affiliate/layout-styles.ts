import type { CSSProperties } from "react";

/**
 * Gemeinsames <main>-Layout aller /affiliate/*-Seiten.
 *
 * `.site-nav` ist `position: fixed` und ~var(--nav-h) hoch (auf iOS zzgl.
 * Safe-Area). Der frühere `paddingTop: 80` maß ab Viewport-Oberkante, sodass
 * die Nav ihn fast komplett verdeckte — sichtbar blieben nur ~3px und der
 * Seitentitel klebte an der Nav (auf Notch-Geräten teils dahinter). Deshalb
 * räumt der paddingTop hier die Nav-Höhe + Safe-Area frei und lässt darunter
 * einen echten Abstand.
 */
export const affiliateMainStyle: CSSProperties = {
  // --nav-h (72px) unterschätzt die real gerenderte Nav-Unterkante um ~5px,
  // daher 45px Offset für ~40px tatsächlich wahrgenommenen Abstand zum Titel.
  paddingTop: "calc(var(--nav-h) + env(safe-area-inset-top, 0px) + 45px)",
  paddingBottom: 80,
  maxWidth: 800,
};
