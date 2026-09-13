"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJobStatus, statusLine } from "./job-view";

/**
 * Laufender Generator-Job in der Listen-Uebersicht — seit 2026-09-13 der
 * EINZIGE Ladezustand des Generators (der Zwischenscreen auf /lists/new
 * ist weg, der Generator schickt direkt hierher). Pollt den Status (der
 * Poll treibt via Self-Heal auch die Verarbeitung, siehe
 * /api/lists/status), haelt die Statuszeile live (Welle 2, E-Mail-Suche,
 * Folge-Lauf — job-view.statusLine) und laesst die server-gerenderte
 * Uebersicht per router.refresh() neu rendern, sobald der Job fertig
 * (→ Listen-Kachel) oder failed (→ Failed-Kachel in MyLists) ist.
 *
 * Bewusst EINE Statuszeile statt der frueheren vier Pipeline-Stufen: das
 * Backend kennt waehrend des Baus nur pending (Outscraper arbeitet) und
 * processing (Sekunden), und der Job pendelt bei Nachschlag-Wellen und
 * der E-Mail-Suche zurueck auf pending — Stufen 2–4 waren nie ehrlich.
 */

const POLL_INTERVAL_MS = 5000;

export function BuildingJobCard({
  jobId,
  listName,
  initialStatusLine,
}: {
  jobId: string;
  listName: string | null;
  /** Server-gerenderter Startwert (job-view.statusLine). */
  initialStatusLine: string;
}) {
  const router = useRouter();
  const [line, setLine] = useState(initialStatusLine);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobStatus(jobId)
        .then((data) => {
          const job = data.job;
          if (!job) return;
          if (job.status === "ready" || job.status === "failed") {
            router.refresh();
            return;
          }
          setLine(statusLine(job.params));
        })
        .catch(() => {
          // Poll-Fehler still schlucken — naechster Tick probiert's wieder.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, router]);

  return (
    <section className="dash-tile dash-tile-plain" aria-live="polite">
      <div className="dash-tile-top">
        <span className="dash-tile-name">{listName ?? "Your list"}</span>
        <span className="lists-src lists-src-generated">Generated</span>
      </div>
      <p className="lists-card-status">{line}</p>
      <p className="dash-tile-sub">
        Usually under a minute — we&apos;ll email you when it&apos;s ready.
      </p>
      <div
        className="dash-bar"
        role="progressbar"
        aria-label="Building your list"
      >
        <div className="lists-card-bar-load" />
      </div>
      <div className="dash-tile-foot">
        <span className="lists-card-building">
          <span className="lists-card-build-dot" aria-hidden="true" />
          Building your list…
        </span>
      </div>
    </section>
  );
}
