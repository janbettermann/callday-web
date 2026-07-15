import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  avatarInitial,
  fetchRecentCalldays,
  fetchRecentLists,
  type DashboardCallday,
  type DashboardList,
} from "@/lib/dashboard/data";
import { AppNav } from "../components/AppNav";
import { AppFooter } from "../components/AppFooter";
import { DashboardGreeting } from "./DashboardGreeting";

export const metadata: Metadata = {
  title: "Dashboard · Callday",
  description: "Your lists and your Calldays at a glance.",
  robots: { index: false, follow: false },
};

// Aktivitaets-Daten sind pro Request frisch (kein Caching der Stats).
export const dynamic = "force-dynamic";

/**
 * /dashboard — Startseite des eingeloggten Bereichs (Post-Login-Landing).
 * Hub-and-Spoke: zeigt die letzten zwei Listen (mit Fortschritt) und die
 * letzten zwei Calldays, jeweils mit Link in die Vollansicht. Beide
 * Sektionen adaptieren ihren Empty-State (First-Run nach Registrierung).
 *
 * Kartendesigns 1:1 aus der App uebernommen (ListCard, ShareCard) —
 * nicht die Entwurfs-Naeherung.
 */
export default async function DashboardPage() {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const admin = getServerSupabase();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  const name = (profileRow?.name as string | null) ?? null;
  const email = (profileRow?.email as string | null) ?? user.email ?? null;
  const firstName = name?.trim().split(/\s+/)[0] || null;
  const initial = avatarInitial(name, email);

  // Datenfehler duerfen das Dashboard nicht mitreissen — dann Empty-State.
  const [lists, calldays] = await Promise.all([
    fetchRecentLists(admin, user.id, 2).catch((err) => {
      console.error("[dashboard] recent lists failed", err);
      return [] as DashboardList[];
    }),
    fetchRecentCalldays(admin, user.id, 3).catch((err) => {
      console.error("[dashboard] recent calldays failed", err);
      return [] as DashboardCallday[];
    }),
  ]);

  const hasLists = lists.length > 0;

  return (
    <>
      <AppNav active="dashboard" initial={initial} />

      <main className="dash-wrap">
        <div className="dash-head">
          <DashboardGreeting firstName={firstName} />
          {/* Marken-Anker "You call…" bewusst NICHT hier (Jan 2026-07-15) —
              er lebt weiter auf Onboarding/Paywall. Der First-Run-Hook bleibt. */}
          {!hasLists && (
            <p className="dash-greet-sub">Your first list is on us.</p>
          )}
        </div>

        {/* ---------- Recent lists ---------- */}
        <section className="dash-sec">
          <div className="dash-sec-head">
            <h2>Recent lists</h2>
          </div>

          {hasLists ? (
            <div className="dash-duo dash-duo-lists">
              {lists.map((list, index) => (
                <ListTile
                  key={list.id}
                  list={list}
                  active={index === 0 && list.worked}
                />
              ))}
            </div>
          ) : (
              <Link href="/lists/new" className="dash-dropin">
                <span className="dash-dropin-ic">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="dash-dropin-txt">
                  <span className="dash-free">First list free</span>
                  <span className="dash-dropin-title">Get your first lead list</span>
                  <span className="dash-dropin-sub">
                    Pick an industry and a city — we scan Google Maps and build a
                    call-ready list. No credit card.
                  </span>
                </span>
                <span className="dash-dropin-go">
                  <ArrowRight />
                </span>
              </Link>
          )}
        </section>

        {/* ---------- Recent Calldays ---------- */}
        <section className="dash-sec">
          <div className="dash-sec-head">
            <h2>Recent Calldays</h2>
          </div>

          {calldays.length > 0 ? (
            <div className="dash-duo">
              {calldays.map((day) => (
                <Sticker
                  key={day.isoDate}
                  name={firstName ?? "You"}
                  day={day}
                />
              ))}
            </div>
          ) : (
            <div className="dash-empty-row">
              <EmptySticker name={firstName ?? "You"} />
              <p className="dash-sec-note">
                A Callday is a day you picked up the phone. Once your list is in,
                this fills up on its own — one sticker per day, ready to share.
              </p>
            </div>
          )}
        </section>

      </main>

      <AppFooter />
    </>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Listen-Kachel — Design aus der App (components/listen/ListCard.tsx):
 * 16px-Titel, ACTIVE-Badge, Fortschrittsbalken, "X / Y leads in list" + %.
 * Web-Anpassung: ganze Kachel verlinkt auf /lists (kein Web-Listen-Detail,
 * kein Actions-Menue — kommt spaeter).
 */
function ListTile({ list, active }: { list: DashboardList; active: boolean }) {
  const denominator = Math.max(list.totalLeads, 1);
  const pct = Math.round((list.totalDone / denominator) * 100);

  return (
    <Link href="/lists" className="dash-tile">
      <div className="dash-tile-top">
        <span className="dash-tile-name">{list.name}</span>
        {active && <span className="dash-badge">Active</span>}
      </div>
      <p className="dash-tile-sub">{list.metaLine}</p>
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
    </Link>
  );
}

/**
 * Callday-Sticker — Design aus der App (components/share/ShareCard.tsx,
 * light-Theme): "{name} · {date}" / "{relative}", zwei Stat-Zeilen
 * (calls, meetings booked), "Callday"-Fusszeile.
 */
function Sticker({ name, day }: { name: string; day: DashboardCallday }) {
  return (
    <div className="dash-sticker">
      <div className="dash-sticker-top">
        <span>
          {name} · {day.label}
        </span>
        <span className="dash-sticker-rel">{day.relative}</span>
      </div>
      <div className="dash-sticker-stats">
        <div className="dash-stat">
          <span className="dash-stat-num">{day.calls}</span>
          <span className="dash-stat-lbl">calls</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">{day.meetings}</span>
          <span className="dash-stat-lbl">meetings booked</span>
        </div>
      </div>
      <div className="dash-sticker-rule" />
      <div className="dash-sticker-foot">Callday</div>
    </div>
  );
}

function EmptySticker({ name }: { name: string }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [, m, d] = todayIso.split("-").map((n) => parseInt(n, 10));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="dash-sticker is-empty">
      <div className="dash-sticker-top">
        <span>
          {name} · {months[m - 1]} {d}
        </span>
        <span className="dash-sticker-rel">Today</span>
      </div>
      <div className="dash-sticker-stats">
        <div className="dash-stat">
          <span className="dash-stat-num">0</span>
          <span className="dash-stat-lbl">calls</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">0</span>
          <span className="dash-stat-lbl">meetings booked</span>
        </div>
      </div>
      <div className="dash-sticker-rule" />
      <div className="dash-sticker-foot">Callday</div>
    </div>
  );
}
