import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase-server";
import { buildListName, fetchLatestJobForUser } from "@/lib/lists/jobs";

/**
 * Lead-Listen-Card auf /account — kompakter Zeiger auf die Listen-Welt,
 * NICHT mehr der Generator selbst (IA-Update 2026-07-13: der Generator
 * lebt auf /lists/new, die Uebersicht auf /lists; /account verwaltet).
 *
 * Server-Component ohne Polling — /account ist Verwaltungsseite, ein
 * laufender Job wird als statischer Status gezeigt, die Live-Ansicht
 * haengt hinter dem Link. Zustaende:
 *   - keine Liste / failed → Promo-Card ("first list free") → /lists/new
 *   - Job laeuft          → Building-Hinweis → /lists
 *   - Liste fertig        → Listen-Zeile + "View your lists" → /lists
 */
export async function LeadListsSection({ userId }: { userId: string }) {
  const admin = getServerSupabase();
  const job = await fetchLatestJobForUser(admin, userId).catch((err) => {
    // Card-Fehler duerfen /account nicht mitreissen — dann eben Promo.
    console.error("[account] lead list fetch failed", err);
    return null;
  });

  if (job?.status === "pending" || job?.status === "processing") {
    return (
      <section className="account-card">
        <h2 className="account-card-title">Lead lists</h2>
        <div className="account-row">
          <span className="account-row-label">
            {buildListName(job.params, job.query)}
          </span>
          <span className="account-row-value">Building…</span>
        </div>
        <p className="account-hint">
          Usually takes 1 to 3 minutes — we&apos;ll email you when it&apos;s
          ready.
        </p>
        <Link href="/lists" className="account-btn account-btn-secondary">
          View progress
        </Link>
      </section>
    );
  }

  if (job?.status === "ready") {
    return (
      <section className="account-card">
        <h2 className="account-card-title">Lead lists</h2>
        <div className="account-row">
          <span className="account-row-label">
            {buildListName(job.params, job.query)}
          </span>
          <span className="account-row-value">
            {job.lead_count ?? 0} leads
          </span>
        </div>
        <Link href="/lists" className="account-btn account-btn-secondary">
          View your lists
        </Link>
        <p className="account-hint">
          Already synced to the Callday app. Need another list? That&apos;s
          coming soon.
        </p>
      </section>
    );
  }

  // Kein Job oder letzter Versuch failed → Promo. Die Fehler-Details
  // zeigt der Generator selbst (/lists/new holt sich den Job-Status).
  return (
    <section
      className="account-card"
      style={{
        borderColor: "rgba(37,99,232,0.3)",
        background:
          "linear-gradient(180deg, rgba(37,99,232,0.06) 0%, rgba(255,255,255,1) 100%)",
      }}
    >
      <h2 className="account-card-title">
        Get your first lead list — free
      </h2>
      <p className="account-body">
        Pick an industry and a city — we scan Google Maps and build a
        call-ready list. Phone numbers only, deduped, synced straight to
        the Callday app.
      </p>
      <Link href="/lists/new" className="account-btn account-btn-primary">
        Create your list
      </Link>
      <p className="account-hint">Your first list is free. No credit card.</p>
    </section>
  );
}
