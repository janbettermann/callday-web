"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchJobStatus } from "./job-view";

/**
 * Laufender Generator-Job in der Listen-Uebersicht — pollt den Status
 * (der Poll treibt via Self-Heal auch die Verarbeitung, siehe
 * /api/lists/status) und laesst die server-gerenderte Uebersicht per
 * router.refresh() neu rendern, sobald der Job fertig oder failed ist.
 */

const POLL_INTERVAL_MS = 5000;

export function BuildingJobCard({
  jobId,
  listName,
}: {
  jobId: string;
  listName: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobStatus(jobId)
        .then((data) => {
          const status = data.job?.status;
          if (status === "ready" || status === "failed") {
            router.refresh();
          }
        })
        .catch(() => {
          // Poll-Fehler still schlucken — naechster Tick probiert's wieder.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, router]);

  return (
    <section className="lists-listcard is-building">
      <div className="lists-listcard-head">
        <div>
          <p className="lists-listcard-name">
            {listName ?? "Your list"}
          </p>
          <p className="lists-listcard-meta">
            Building — usually 1 to 3 minutes. We&apos;ll email you when
            it&apos;s ready.
          </p>
        </div>
      </div>
      <div
        className="lists-progress-track lists-listcard-progress"
        role="progressbar"
        aria-label="Building your list"
      >
        <div className="lists-progress-fill" />
      </div>
    </section>
  );
}
