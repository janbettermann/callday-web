import type { ReactNode } from "react";
import { AppFooter } from "./AppFooter";

/**
 * Gerüst aller eingeloggten Account-Seiten (Dashboard, Calldays, Account,
 * Lists, Generator). Sticky-Footer via Flex-Spalte: bei wenig Content sitzt
 * der Footer sichtbar am Viewport-Boden (Seite nicht scrollbar), bei viel
 * Content schiebt der Content ihn nach unten. Die fixe AppNav bleibt
 * ausserhalb des Flusses; `main` (flex:1) fuellt den Rest. Der AppFooter
 * wird hier EINMAL zentral gerendert, nicht mehr pro Seite.
 *
 * Bewusst KEIN Route-Group-Layout: das haette einen Move aller 5 Seiten-
 * Ordner samt co-located Files + Relativ-Import-Fixes bedeutet — gleicher
 * Effekt, deutlich mehr Risiko.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      {children}
      <AppFooter />
    </div>
  );
}
