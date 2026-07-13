/**
 * Stilisierte Callday-Pre-Call-Karte mit dem ersten echten Lead —
 * verkauft das Erlebnis, nicht nur die Daten. Bewusst vereinfacht,
 * kein pixelgenauer App-Zwilling, nicht interaktiv.
 *
 * Rein presentational (kein Client-State) — nutzbar aus Server- und
 * Client-Components (Ready-State auf /lists/new, Uebersicht auf /lists).
 */

import type { PreviewLead } from "./job-view";

export function LeadPreviewCard({ lead }: { lead: PreviewLead }) {
  const rating = lead.custom_fields?.google_rating;
  const meta = [lead.industry, lead.location].filter(Boolean).join(" — ");

  return (
    <div
      className="lists-precall-stack"
      aria-label="Preview of your first lead as a Callday call card"
    >
      <div className="lists-precall-shadow lists-precall-shadow-2" aria-hidden="true" />
      <div className="lists-precall-shadow lists-precall-shadow-1" aria-hidden="true" />
      <div className="lists-precall-card">
        <p className="lists-precall-label">Your first call</p>
        <p className="lists-precall-name">{lead.company_name}</p>
        {meta && <p className="lists-precall-meta">{meta}</p>}
        {rating && <p className="lists-precall-rating">{rating}</p>}
        <div className="lists-precall-callbtn" aria-hidden="true">
          Call {lead.phone}
        </div>
        <div className="lists-precall-ghost-row" aria-hidden="true">
          <span className="lists-precall-ghost">Skip</span>
          <span className="lists-precall-ghost">Called</span>
        </div>
      </div>
    </div>
  );
}
