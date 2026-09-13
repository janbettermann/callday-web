import Link from "next/link";
import type { DashboardList } from "@/lib/dashboard/data";
import { BuildingJobCard } from "./BuildingJobCard";
import { ListCardActions } from "../components/ListCardActions";

/**
 * Listen-Uebersicht auf /lists (eingeloggt) — dieselben Kacheln wie das
 * Dashboard (.dash-duo-lists: 2-spaltig), nur nicht
 * verlinkt (.dash-tile-plain) und mit Quelle-Pill oben rechts. Datenquelle
 * sind die synced Listen (lead_lists, Demo ausgeblendet); ein laufender
 * Generator-Job sitzt als pollende Building-Kachel oben. Kein In-Page-
 * "New list"-Button (die AppNav traegt ihn).
 *
 * Quelle: `Generated` = ueber den Callday-Generator erstellt, `Imported`
 * = in der App per Datei importiert (Unterscheidung server-seitig in
 * page.tsx ueber die Existenz eines Generator-Jobs).
 *
 * Job-Kachel (Jan 2026-09-13): seit der Generator ohne Zwischenscreen
 * direkt hierher schickt, ist /lists der einzige Ort, an dem der User den
 * Ausgang seines Laufs sieht. Deshalb ist "failed" jetzt ein eigener
 * Kachel-Zustand (rote Pill + Fehlertext + "Try again", frueher bewusst
 * vertagt) — nur fuer den NEUESTEN Job, der naechste Lauf ersetzt ihn.
 * Ohne Listen zeigt weiter der Empty-State den Fehler als Hinweis.
 *
 * Actions-Footer (geteiltes ListCardActions): "Open in Callday" (brandblau)
 * + "Download list". Der Download zeigt auf /api/lists/download; "Open in
 * Callday" ist interim auf den App-Download-Pfad verdrahtet — die kontext-
 * abhaengige Deep-Link-Logik kommt gemaess specs/open-in-callday.md.
 */

export type ListSource = "generated" | "imported";

export interface ListCardData extends DashboardList {
  source: ListSource;
}

export type JobCardData =
  | {
      kind: "building";
      jobId: string;
      listName: string;
      /** Startwert der Statuszeile (job-view.statusLine), Kachel pollt weiter. */
      statusLine: string;
    }
  | {
      kind: "failed";
      listName: string;
      /** Nutzer-Text (job-view.failureMessage). */
      message: string;
    };

export function MyLists({
  lists,
  job,
}: {
  lists: ListCardData[];
  job: JobCardData | null;
}) {
  const isEmpty = lists.length === 0 && job?.kind !== "building";

  return (
    <div className="lists-inner-account">
      <div className="dash-head">
        <h1 className="dash-greet">Your lists</h1>
      </div>

      {isEmpty ? (
        <EmptyState
          failureNote={job?.kind === "failed" ? job.message : null}
        />
      ) : (
        <div className="dash-duo dash-duo-lists">
          {job?.kind === "building" && (
            <BuildingJobCard
              jobId={job.jobId}
              listName={job.listName}
              initialStatusLine={job.statusLine}
            />
          )}
          {job?.kind === "failed" && (
            <FailedJobCard listName={job.listName} message={job.message} />
          )}
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourcePill({ source }: { source: ListSource }) {
  return source === "generated" ? (
    <span className="lists-src lists-src-generated">Generated</span>
  ) : (
    <span className="lists-src lists-src-imported">Imported</span>
  );
}

/**
 * Listen-Kachel im Dashboard-Look (.dash-tile), aber nicht verlinkt
 * (.dash-tile-plain, kein Web-Listen-Detail) und mit Quelle-Pill statt
 * "Active"-Badge oben rechts.
 */
function ListCard({ list }: { list: ListCardData }) {
  const denominator = Math.max(list.totalLeads, 1);
  const pct = Math.round((list.totalDone / denominator) * 100);
  const sub = list.worked
    ? list.metaLine
    : `${list.source === "generated" ? "Built" : "Imported"} ${list.createdAtRelative}`;

  return (
    <div className="dash-tile dash-tile-plain">
      <div className="dash-tile-top">
        <span className="dash-tile-name">{list.name}</span>
        <SourcePill source={list.source} />
      </div>
      <p className="dash-tile-sub">{sub}</p>
      <div className="dash-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="dash-tile-foot">
        <span>
          {list.totalDone.toLocaleString("en-US")} /{" "}
          {list.totalLeads.toLocaleString("en-US")} leads in list
        </span>
        <b>{pct}%</b>
      </div>
      {/* Actions-Footer — geteiltes ListCardActions (Open in Callday +
          Download list), identisch mit den Dashboard-Kacheln. */}
      <ListCardActions listId={list.id} listName={list.name} />
    </div>
  );
}

/**
 * Fehlgeschlagener letzter Lauf als Kachel: rote Pill + Fehlertext statt
 * Balken, "Try again" fuehrt in den Generator. Kein Dismiss noetig — der
 * naechste Lauf ersetzt die Kachel (neuester Job gewinnt, page.tsx).
 */
function FailedJobCard({
  listName,
  message,
}: {
  listName: string;
  message: string;
}) {
  return (
    <section className="dash-tile dash-tile-plain" role="alert">
      <div className="dash-tile-top">
        <span className="dash-tile-name">{listName}</span>
        <span className="lists-src lists-src-failed">Failed</span>
      </div>
      <p className="dash-tile-sub lists-card-failmsg">{message}</p>
      <div className="dash-tile-actions">
        <Link href="/lists/new" className="dash-tile-action dash-tile-action-primary">
          Try again
        </Link>
      </div>
    </section>
  );
}

function EmptyState({ failureNote }: { failureNote: string | null }) {
  return (
    <section className="account-card lists-empty">
      <h2 className="account-card-title">Get your first lead list — free</h2>
      <p className="account-body">
        Pick an industry and a city — we scan Google Maps and build a
        call-ready list. Phone numbers only, deduped, synced straight to the
        Callday app.
      </p>
      {failureNote && (
        <p className="account-body lists-empty-failnote">{failureNote}</p>
      )}
      <Link href="/lists/new" className="account-btn account-btn-primary">
        Create your first list
      </Link>
      <p className="account-hint">Your first list is free. No credit card.</p>
    </section>
  );
}
