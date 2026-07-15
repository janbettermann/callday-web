import Link from "next/link";
import type { DashboardList } from "@/lib/dashboard/data";
import { BuildingJobCard } from "./BuildingJobCard";

/**
 * Listen-Uebersicht auf /lists (eingeloggt) — Karten im Dashboard-Design
 * (components/ListTile-Look: Name, Quelle-Pill, Fortschrittsbalken,
 * "x / y leads in list"). Datenquelle sind die synced Listen (lead_lists,
 * Demo ausgeblendet); ein laufender Generator-Job sitzt als pollende
 * Building-Card oben. Kein In-Page-"New list"-Button (die AppNav traegt
 * ihn), kein Sub, keine Download-Aktionen.
 *
 * Quelle: `Generated` = ueber den Callday-Generator erstellt, `Imported`
 * = in der App per Datei importiert (Unterscheidung passiert server-seitig
 * in page.tsx ueber die Existenz eines Generator-Jobs).
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
      <header className="lists-workhead">
        <h1 className="lists-worktitle">Your lead lists</h1>
      </header>

      {building && (
        <BuildingJobCard jobId={building.jobId} listName={building.listName} />
      )}

      {lists.map((list) => (
        <ListCard key={list.id} list={list} />
      ))}

      {isEmpty && <EmptyState hadFailure={hadFailure} />}
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

function ListCard({ list }: { list: ListCardData }) {
  const denominator = Math.max(list.totalLeads, 1);
  const pct = Math.round((list.totalDone / denominator) * 100);
  const sub = list.worked
    ? list.metaLine
    : `${list.source === "generated" ? "Built" : "Imported"} ${list.createdAtRelative}`;

  return (
    <section className="lists-listcard">
      <div className="lists-card-top">
        <span className="lists-listcard-name">{list.name}</span>
        <SourcePill source={list.source} />
      </div>
      <p className="lists-card-sub">{sub}</p>
      <div className="lists-card-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="lists-card-foot">
        <span>
          {list.totalDone.toLocaleString("en-US")} /{" "}
          {list.totalLeads.toLocaleString("en-US")} leads in list
        </span>
        <b>{pct}%</b>
      </div>
    </section>
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
