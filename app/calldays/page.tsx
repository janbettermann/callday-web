import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  fetchAllCalldays,
  fetchProfileIdentity,
  type DashboardCallday,
} from "@/lib/dashboard/data";
import { AppNav } from "../components/AppNav";
import { AppShell } from "../components/AppShell";
import {
  CalldaySticker,
  EmptyCalldaySticker,
} from "../components/CalldaySticker";

export const metadata: Metadata = {
  title: "Your Calldays · Callday",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /calldays — Vollansicht aller Call-Tage (Ziel des "Calldays"-Nav-Tabs).
 * Jeder Tag, an dem der User telefoniert hat, als teilbarer Sticker; das
 * Dashboard zeigt nur die letzten drei. Leerer Zustand: ein Muster-Sticker
 * (heute, 0 calls) plus Hinweis.
 */
export default async function CalldaysPage() {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/calldays");

  const admin = getServerSupabase();
  const [{ initial }, calldays] = await Promise.all([
    fetchProfileIdentity(admin, user.id, user.email ?? null),
    // Datenfehler duerfen die Seite nicht mitreissen — dann Empty-State.
    fetchAllCalldays(admin, user.id).catch((err) => {
      console.error("[calldays] fetch failed", err);
      return [] as DashboardCallday[];
    }),
  ]);

  return (
    <AppShell>
      <AppNav active="calldays" initial={initial} />

      <main className="dash-wrap">
        <div className="dash-head">
          <h1 className="dash-greet">Your Calldays</h1>
        </div>

        {calldays.length > 0 ? (
          <div className="dash-duo">
            {calldays.map((day) => (
              <CalldaySticker key={day.isoDate} day={day} />
            ))}
          </div>
        ) : (
          <div className="dash-empty-row">
            <EmptyCalldaySticker />
            <p className="dash-sec-note">
              A Callday is a day you picked up the phone. Once your list is in,
              this fills up on its own — one sticker per day, ready to share.
            </p>
          </div>
        )}
      </main>
    </AppShell>
  );
}
