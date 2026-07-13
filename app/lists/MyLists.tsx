import Link from "next/link";
import { APP_DOWNLOAD_PATH } from "@/lib/lists/config";
import type { JobView } from "./job-view";
import { BuildingJobCard } from "./BuildingJobCard";

/**
 * Listen-Uebersicht auf /lists (eingeloggt) — server-gerendert aus den
 * lead_gen_jobs des Users. Fertige Listen als Cards mit Downloads,
 * ein laufender Job als pollende Building-Card (Client), Failed-Jobs
 * tauchen nur als Hinweis im Empty-State auf (die Fehler-Details zeigt
 * der Generator auf /lists/new).
 */

export function MyLists({ jobs }: { jobs: JobView[] }) {
  const running =
    jobs.find((j) => j.status === "pending" || j.status === "processing") ??
    null;
  const ready = jobs.filter((j) => j.status === "ready");
  const lastFailed =
    !running && ready.length === 0
      ? (jobs.find((j) => j.status === "failed") ?? null)
      : null;
  const isEmpty = !running && ready.length === 0;

  return (
    <div className="lists-inner">
      <header className="lists-topbar">
        <div>
          <h1 className="lists-worktitle">Your lead lists</h1>
          <p className="lists-worksub">
            {isEmpty
              ? "Lists you build land here — synced straight to the Callday app."
              : ready.length === 1
                ? "1 list, synced to the Callday app."
                : `${ready.length} lists, synced to the Callday app.`}
          </p>
        </div>
        {!isEmpty && (
          <Link
            href="/lists/new"
            className="account-btn account-btn-primary lists-newbtn"
          >
            + New list
          </Link>
        )}
      </header>

      {running && (
        <BuildingJobCard jobId={running.id} listName={running.listName} />
      )}

      {ready.map((job) => (
        <ListCard key={job.id} job={job} />
      ))}

      {isEmpty && <EmptyState hadFailure={lastFailed !== null} />}

      {!isEmpty && (
        <>
          <p className="lists-meta">
            Need another list? That&apos;s coming soon.
          </p>
          <section className="account-card lists-app-card">
            <h2 className="account-card-title">Call them with the app</h2>
            <p className="account-body lists-app-benefits">
              Your lists are already synced — install Callday on your iPhone,
              open the app and start calling. Every outcome gets tracked
              automatically.
            </p>
            <Link
              href={APP_DOWNLOAD_PATH}
              className="account-btn account-btn-primary"
            >
              Get the Callday app
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function websiteFilterNote(job: JobView): string {
  if (job.params.website === "without") return " (without websites)";
  if (job.params.website === "with") return " (with websites)";
  return "";
}

function ListCard({ job }: { job: JobView }) {
  const created = new Date(job.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const leadCount = job.leadCount ?? 0;

  return (
    <section className="lists-listcard">
      <div className="lists-listcard-head">
        <div>
          <p className="lists-listcard-name">{job.listName}</p>
          <p className="lists-listcard-meta">
            {leadCount} callable leads, built {created}
            {websiteFilterNote(job)}
          </p>
        </div>
        <span className="lists-synced-badge">Synced</span>
      </div>
      {job.listId && (
        <div className="lists-listcard-actions">
          <a
            href={`/api/lists/download?list=${job.listId}&format=xlsx`}
            className="account-btn account-btn-secondary"
          >
            Download for Excel
          </a>
          <a
            className="lists-meta-link"
            href={`/api/lists/download?list=${job.listId}`}
          >
            Download CSV
          </a>
        </div>
      )}
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
      <Link
        href="/lists/new"
        className="account-btn account-btn-primary"
      >
        Create your first list
      </Link>
      <p className="account-hint">Your first list is free. No credit card.</p>
    </section>
  );
}
