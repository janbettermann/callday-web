import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { buildListName, fetchJobsForUser } from "@/lib/lists/jobs";
import { fetchAllLists, fetchProfileIdentity } from "@/lib/dashboard/data";
import { AppNav } from "../components/AppNav";
import { AppShell } from "../components/AppShell";
import { MyLists, type ListCardData } from "./MyLists";

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
    "Pick an industry and a city — we scan Google Maps and build a call-ready lead list. Every lead has a phone number. Your first list is free.",
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

  const params = await searchParams;
  const website = typeof params.website === "string" ? params.website : null;

  if (!user) {
    // /lists ist login-only (Weg A, 2026-07-17): keine eigene ausgeloggte
    // Listen-Landing mehr (ListsClient stillgelegt). Ein Funnel-Preset
    // traegt die Generator-Absicht durch Login/Signup; ohne Preset gehen
    // ausgeloggte Besucher auf die Haupt-Landing.
    if (website === "without" || website === "with") {
      redirect(
        `/login?next=${encodeURIComponent(`/lists/new?website=${website}`)}`,
      );
    }
    redirect("/");
  }

  if (website === "without" || website === "with") {
    redirect(`/lists/new?website=${website}`);
  }

  const admin = getServerSupabase();
  const [identity, lists, jobs] = await Promise.all([
    fetchProfileIdentity(admin, user.id, user.email ?? null),
    fetchAllLists(admin, user.id),
    fetchJobsForUser(admin, user.id),
  ]);

  // Quelle: hat die Liste einen Generator-Job → "Generated", sonst
  // (App-Datei-Import) → "Imported".
  const generatedListIds = new Set(
    jobs.map((job) => job.list_id).filter((id): id is string => Boolean(id)),
  );
  const cards: ListCardData[] = lists.map((list) => ({
    ...list,
    source: generatedListIds.has(list.id) ? "generated" : "imported",
  }));

  // Laufender Job (noch keine lead_lists-Row) → Building-Card oben.
  const runningJob = jobs.find(
    (job) => job.status === "pending" || job.status === "processing",
  );
  const building = runningJob
    ? {
        jobId: runningJob.id,
        listName: buildListName(runningJob.params, runningJob.query),
      }
    : null;

  // Fehlgeschlagener letzter Versuch nur relevant, wenn sonst nichts da ist.
  const hadFailure =
    cards.length === 0 && !building
      ? jobs.some((job) => job.status === "failed")
      : false;

  return (
    <AppShell>
      <AppNav active="lists" initial={identity.initial} />
      <main className="lists-page">
        <MyLists lists={cards} building={building} hadFailure={hadFailure} />
      </main>
    </AppShell>
  );
}
