import Link from "next/link";
import type { DashboardList } from "@/lib/dashboard/data";
import { BuildingJobCard } from "./BuildingJobCard";

/**
 * Listen-Uebersicht auf /lists (eingeloggt) — dieselben Kacheln wie das
 * Dashboard (.dash-duo-lists: 2-spaltig, skalierte .dash-tile), nur nicht
 * verlinkt (.dash-tile-plain) und mit Quelle-Pill oben rechts. Datenquelle
 * sind die synced Listen (lead_lists, Demo ausgeblendet); ein laufender
 * Generator-Job sitzt als pollende Building-Kachel oben. Kein In-Page-
 * "New list"-Button (die AppNav traegt ihn).
 *
 * Quelle: `Generated` = ueber den Callday-Generator erstellt, `Imported`
 * = in der App per Datei importiert (Unterscheidung server-seitig in
 * page.tsx ueber die Existenz eines Generator-Jobs).
 *
 * Actions-Footer (Design-B, 2026-07-26): jede Card hat unten "Download
 * CSV" + "Preview leads". Handler-Wiring folgt separat — aktuell reines
 * UI-Skeleton (Buttons haben noch keinen Effekt). Die Endpoints
 * (/api/lists/[id]/export, Preview-Sheet) kommen im Follow-up.
 */

export type ListSource = "generated" | "imported";

export interface ListCardData extends DashboardList {
  source: ListSource;
}

export interface BuildingList {
  jobId: string;
  listName: string;
}

export function MyLists({
  lists,
  building,
  hadFailure,
}: {
  lists: ListCardData[];
  building: BuildingList | null;
  hadFailure: boolean;
}) {
  const isEmpty = lists.length === 0 && !building;

  return (
    <div className="lists-inner-account">
      <div className="dash-head">
        <h1 className="dash-greet">Your lists</h1>
      </div>

      {isEmpty ? (
        <EmptyState hadFailure={hadFailure} />
      ) : (
        <div className="dash-duo dash-duo-lists">
          {building && (
            <BuildingJobCard
              jobId={building.jobId}
              listName={building.listName}
            />
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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
      {/* Actions-Footer — Design-B, 2026-07-26. Download-Link zeigt auf
          die bestehende /api/lists/download-Route mit format=xlsx
          (formatierter Excel-Export, locale-safe; siehe Route-Doc).
          Preview-Button ist noch UI-Skeleton — Sheet-Component folgt
          separat. */}
      <div className="dash-tile-actions">
        <a
          href={`/api/lists/download?list=${list.id}&format=xlsx`}
          download
          className="dash-tile-action"
          aria-label={`Download list ${list.name}`}
        >
          <DownloadIcon />
          Download list
        </a>
        <button type="button" className="dash-tile-action" aria-label={`Preview leads in ${list.name}`}>
          <EyeIcon />
          Preview leads
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hadFailure }: { hadFailure: boolean }) {
  return (
    <section className="account-card lists-empty">
      <h2 className="account-card-title">Get your first lead list — free</h2>
      <p className="account-body">
        Pick an industry and a city — we scan Google Maps and build a
        call-ready list. Phone numbers only, deduped, synced straight to the
        Callday app.
      </p>
      {hadFailure && (
        <p className="account-body lists-empty-failnote">
          Your last attempt didn&apos;t find enough callable leads — a
          broader industry or a bigger city usually does the trick.
        </p>
      )}
      <Link href="/lists/new" className="account-btn account-btn-primary">
        Create your first list
      </Link>
      <p className="account-hint">Your first list is free. No credit card.</p>
    </section>
  );
}
