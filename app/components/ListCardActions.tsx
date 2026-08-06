import Link from "next/link";
import { APP_DOWNLOAD_PATH } from "@/lib/lists/config";

/**
 * Actions-Footer der Listen-Kacheln (/lists + Dashboard). Zwei Buttons:
 * primaeres "Open in Callday" (brandblau) LINKS, "Download list" (Ghost,
 * wie gehabt) RECHTS daneben. Geteilt zwischen MyLists (/lists) und dem
 * Dashboard-ListTile, damit die zwei Kacheln nicht divergieren.
 *
 * "Open in Callday" ist aktuell INTERIM verdrahtet: zeigt vorerst auf den
 * App-Download/Open-Pfad (APP_DOWNLOAD_PATH). Die kontext-abhaengige
 * Ziel-Logik — Universal Link `callday.io/open/list/<id>` im normalen
 * Browser (App installiert -> App, sonst -> App Store), `dealswipe://
 * open-list/<id>` im In-App-Browser mit Auto-Dismiss — kommt gemaess
 * `specs/open-in-callday.md` (callday-app). Beim Wiring nur die `href`
 * hier ersetzen (bzw. kontextabhaengig setzen).
 */
export function ListCardActions({
  listId,
  listName,
}: {
  listId: string;
  listName: string;
}) {
  return (
    <div className="dash-tile-actions">
      <Link
        href={APP_DOWNLOAD_PATH}
        className="dash-tile-action dash-tile-action-primary"
        aria-label={`Open ${listName} in Callday`}
      >
        <CalldayMark />
        Open in Callday
      </Link>
      <a
        href={`/api/lists/download?list=${listId}&format=xlsx`}
        download
        className="dash-tile-action"
        aria-label={`Download list ${listName}`}
      >
        Download list
      </a>
    </div>
  );
}

/**
 * Callday-Marke fuers Button-Icon: Bogen + Sonne 1:1 aus dem echten Logo
 * (CalldayLogo.tsx, viewBox 120, Sonne mittig bei 60/60) — aber OHNE das
 * blaue Hintergrund-Quadrat und den Glow, sodass nur das "C" mit der
 * Gold-Sonne direkt auf dem blauen Button steht. Der Bogen erbt die weisse
 * Button-Farbe (currentColor), die Sonne bleibt Marken-Gold (var(--sun)).
 * Geometrie aus dem Original, damit die Sonne wirklich zentriert sitzt.
 * viewBox aufs C zugeschnitten (statt 0 0 120 120): das Original hatte das
 * App-Quadrat-Padding mitgerechnet, wodurch die Marke im Button zu klein
 * wirkte — der Zuschnitt laesst das C die Icon-Flaeche fuellen (gleiche
 * Icon-Groesse, also keine Aenderung an Button-Hoehe/Ausrichtung).
 */
function CalldayMark() {
  return (
    <svg width="18" height="18" viewBox="18 18 84 84" fill="none" aria-hidden="true">
      <path
        d="M 84.6 42.8 A 30 30 0 1 0 84.6 77.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="12" fill="var(--sun)" />
    </svg>
  );
}
