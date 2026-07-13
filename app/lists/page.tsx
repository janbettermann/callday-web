import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { buildListName, fetchJobsForUser } from "@/lib/lists/jobs";
import type { JobView } from "./job-view";
import { ListsClient } from "./ListsClient";
import { ListsNav } from "./ListsNav";
import { MyLists } from "./MyLists";

/**
 * callday.io/lists — auth-aware Front-Door der Listen-Welt (Spec:
 * specs/lists-generator.md §2b/§3).
 *
 *   - Ausgeloggt: Akquise-Landing mit Message-Match fuer Listen-Intent
 *     (ListsClient) — Signup fuehrt direkt in den Generator.
 *   - Eingeloggt: die Listen-Uebersicht (MyLists), server-gerendert.
 *     Das ist das Logged-in-Zuhause; der Generator selbst lebt auf
 *     /lists/new.
 *   - Eingeloggt MIT ?website=-Preset: der Link traegt Generate-Intent
 *     (Affiliate-/Funnel-Links) → direkt in den Generator durchreichen.
 *
 * Der Auth-Check laeuft server-seitig (SSR-Cookie-Session wie /account)
 * statt ueber den useIsLoggedIn-Client-Swap der Marketing-Landing —
 * die eingeloggte Ansicht braucht Server-Daten, kein Content-Swap.
 */

export const metadata: Metadata = {
  title: "Callday Lists — your cold-calling list in 2 minutes",
  description:
    "Pick an industry and a city — we build a call-ready lead list. Every lead has a phone number. Your first list is free.",
};

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ListsClient />;
  }

  const params = await searchParams;
  const website = typeof params.website === "string" ? params.website : null;
  if (website === "without" || website === "with") {
    redirect(`/lists/new?website=${website}`);
  }

  const admin = getServerSupabase();
  const jobs = await fetchJobsForUser(admin, user.id);
  const jobViews: JobView[] = jobs.map((job) => ({
    id: job.id,
    status: job.status,
    error: job.error,
    leadCount: job.lead_count,
    listId: job.list_id,
    listName: buildListName(job.params, job.query),
    params: job.params,
    createdAt: job.created_at,
  }));

  return (
    <>
      <ListsNav authed />
      <main className="lists-page">
        <MyLists jobs={jobViews} />
      </main>
    </>
  );
}
