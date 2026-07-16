import type { ReactNode } from "react";

/**
 * Gerüst aller eingeloggten Account-Seiten (Dashboard, Calldays, Account,
 * Lists, Generator). Flex-Spalte mit `min-height:100dvh`; `main` (flex:1)
 * fuellt den Viewport — bei wenig Content sitzt er oben, der Rest bleibt
 * leerer Raum (App-Shell-Look wie Figma/Linear, KEIN Marketing-Footer im
 * eingeloggten Bereich). Die fixe AppNav bleibt ausserhalb des Flusses.
 *
 * Legal-Links (Privacy/Terms/Imprint) leben seit dem Footer-Wegfall
 * (Jan 2026-07-17) dezent am Fuss der Account-Seite (`/account`) — von
 * jeder Seite in 1 Klick ueber die Avatar-Pille erreichbar, erfuellt die
 * Impressumspflicht-„staendig verfuegbar".
 *
 * Bewusst KEIN Route-Group-Layout: das haette einen Move aller 5 Seiten-
 * Ordner samt co-located Files + Relativ-Import-Fixes bedeutet — gleicher
 * Effekt, deutlich mehr Risiko.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>;
}
