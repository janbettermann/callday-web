import { describe, expect, it } from "vitest";

import {
  buildDashboard,
  parseDashboardRange,
  startOfIsoWeekUtc,
  type CallRow,
  type DashboardSource,
  type FeedbackRow,
  type ProfileRow,
} from "./dashboard-metrics";

// 2026-09-14 ist ein Montag, mittags. Damit landet "heute" in der
// laufenden Woche und "vor 1 Tag" in der Vorwoche.
const NOW = Date.parse("2026-09-14T12:00:00.000Z");
const DAY = 86_400_000;

function ago(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

function profile(
  partial: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">,
): ProfileRow {
  return {
    name: null,
    created_at: ago(100),
    onboarding_completed: false,
    subscription_status: null,
    subscription_plan: null,
    plan_type: null,
    ...partial,
  };
}

function call(user_id: string, daysAgo: number, outcome = "meeting"): CallRow {
  return { user_id, called_at: ago(daysAgo), outcome };
}

let feedbackId = 1;
function feedback(
  email: string | null,
  daysAgo: number,
  partial: Partial<FeedbackRow> = {},
): FeedbackRow {
  return {
    id: String(feedbackId++),
    email,
    category: "bug",
    rating: null,
    text: "x",
    app_version: "1.0",
    source: "app",
    created_at: ago(daysAgo),
    ...partial,
  };
}

const SOURCE: DashboardSource = {
  profiles: [
    // Extern, frisch, aktiv, im Trial.
    profile({
      id: "alice",
      email: "alice@example.com",
      created_at: ago(3),
      onboarding_completed: true,
      subscription_status: "trialing",
      subscription_plan: "monthly",
    }),
    // Extern, 40 Tage dabei, nie gecallt.
    profile({ id: "bob", email: "bob@example.com", created_at: ago(40) }),
    // Extern, zahlend (Founder, jaehrlich), seit 12 Tagen kein Call.
    profile({
      id: "carol",
      email: "carol@example.com",
      created_at: ago(20),
      onboarding_completed: true,
      subscription_status: "active",
      subscription_plan: "yearly",
      plan_type: "founder",
    }),
    // Extern, gestern Abend angemeldet, noch nichts gemacht (Schonfrist).
    profile({ id: "dave", email: "dave@example.com", created_at: ago(0.75) }),
    // Extern, alt, gekuendigt, letzter Call vor 50 Tagen.
    profile({
      id: "erin",
      email: "erin@example.com",
      created_at: ago(100),
      subscription_status: "canceled",
    }),
    // Intern: Jans Plus-Tag-Konto, sehr aktiv.
    profile({ id: "jan", email: "jan.bettermann11+9@gmail.com", created_at: ago(5) }),
    // Intern: App-Review-Login.
    profile({ id: "review", email: "review@callday.io", created_at: ago(200) }),
  ],
  calls: [
    call("alice", 2, "meeting"),
    call("alice", 1, "no_interest"),
    call("carol", 13, "callback"),
    call("carol", 12, "callback"),
    call("erin", 50),
    call("jan", 1),
    call("jan", 1),
    call("jan", 1),
  ],
  lists: [
    { user_id: "alice", created_at: ago(3) },
    { user_id: "carol", created_at: ago(19) },
    { user_id: "jan", created_at: ago(4) },
  ],
  feedback: [
    feedback("alice@example.com", 2),
    feedback("jan.bettermann11+9@gmail.com", 1),
    feedback("bob@example.com", 45),
    // Sterne ohne Text: nicht in der Liste, aber im Schnitt.
    feedback("alice@example.com", 3, { category: "rating", rating: 5, text: null }),
    feedback("bob@example.com", 10, { category: "rating", rating: 3, text: "ok" }),
    // Interne Bewertung zaehlt standardmaessig nicht.
    feedback("review@callday.io", 4, { category: "rating", rating: 1, text: null }),
  ],
  subscriptionEvents: [
    {
      id: "e1",
      event_type: "INITIAL_PURCHASE",
      app_user_id: "alice",
      product_id: "monthly",
      received_at: ago(2),
    },
    { id: "e2", event_type: "RENEWAL", app_user_id: "jan", product_id: "monthly", received_at: ago(1) },
    { id: "e3", event_type: "RENEWAL", app_user_id: "unknown", product_id: null, received_at: ago(3) },
  ],
};

const DEFAULT = buildDashboard(SOURCE, { rangeDays: 30, includeInternal: false, now: NOW });

describe("parseDashboardRange", () => {
  it("kennt 7, 30 und 90 und faellt sonst auf 30 zurueck", () => {
    expect(parseDashboardRange("7")).toBe(7);
    expect(parseDashboardRange("90")).toBe(90);
    expect(parseDashboardRange("30")).toBe(30);
    expect(parseDashboardRange("14")).toBe(30);
    expect(parseDashboardRange(undefined)).toBe(30);
  });
});

describe("startOfIsoWeekUtc", () => {
  it("liefert den Montag 00:00 UTC", () => {
    expect(new Date(startOfIsoWeekUtc(NOW)).toISOString()).toBe("2026-09-14T00:00:00.000Z");
    // Sonntag gehoert noch zur Vorwoche.
    const sunday = Date.parse("2026-09-13T23:00:00.000Z");
    expect(new Date(startOfIsoWeekUtc(sunday)).toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });
});

describe("buildDashboard: Intern-Filter", () => {
  it("blendet interne Accounts standardmaessig aus und zaehlt sie", () => {
    expect(DEFAULT.internalHidden).toBe(2);
    expect(DEFAULT.users.map((u) => u.user_id)).not.toContain("jan");
    expect(DEFAULT.kpis.activeCallers.current).toBe(2);
  });

  it("nimmt interne Accounts auf Wunsch mit", () => {
    const all = buildDashboard(SOURCE, { rangeDays: 30, includeInternal: true, now: NOW });
    expect(all.internalHidden).toBe(0);
    expect(all.kpis.signups.current).toBe(4);
    expect(all.kpis.activeCallers.current).toBe(3);
    expect(all.users).toHaveLength(7);
    expect(all.ratings).toEqual({ count: 3, average: 3 });
    expect(all.subscriptions.events.map((e) => e.id)).toEqual(["e2", "e1", "e3"]);
  });
});

describe("buildDashboard: Kennzahlen", () => {
  it("zaehlt Zeitraum und Vorperiode getrennt", () => {
    const { kpis } = DEFAULT;
    expect(kpis.signups).toEqual({ current: 3, previous: 1 });
    // Erste Liste: alice (3d), carol (19d); jans Liste ist intern.
    expect(kpis.firstList).toEqual({ current: 2, previous: 0 });
    expect(kpis.activated).toEqual({ current: 2, previous: 1 });
    expect(kpis.activeCallers).toEqual({ current: 2, previous: 1 });
    expect(kpis.paying).toBe(1);
    expect(kpis.trialing).toBe(1);
  });

  it("verschiebt die Vorperiode mit dem Zeitraum", () => {
    const week = buildDashboard(SOURCE, { rangeDays: 7, includeInternal: false, now: NOW });
    // Sign-ups: alice (3d), dave (<1d); in [14d, 7d) hat sich niemand angemeldet.
    expect(week.kpis.signups).toEqual({ current: 2, previous: 0 });
    // Erster Call: alice (2d) jetzt, carol (13d) in der Vorwoche.
    expect(week.kpis.activated).toEqual({ current: 1, previous: 1 });
    // Erste Liste: alice (3d) jetzt, carol (19d) vor der Vorwoche.
    expect(week.kpis.firstList).toEqual({ current: 1, previous: 0 });
    expect(week.dailyCallers).toHaveLength(7);
  });
});

describe("buildDashboard: Sign-ups pro Woche", () => {
  it("liefert 12 Wochen, Montag-basiert, mit Aktivierung", () => {
    const weeks = DEFAULT.weeklySignups;
    expect(weeks).toHaveLength(12);
    expect(weeks[0].weekStart).toBe("2026-06-29");
    expect(weeks[11].weekStart).toBe("2026-09-14");
    // alice (3d) und dave (gestern) liegen in der Vorwoche, nur alice hat gecallt.
    expect(weeks[10]).toEqual({ weekStart: "2026-09-07", signups: 2, activated: 1 });
    expect(weeks[11].signups).toBe(0);
    expect(weeks.reduce((sum, w) => sum + w.signups, 0)).toBe(4);
  });
});

describe("buildDashboard: nicht gerenderte Bloecke bleiben korrekt", () => {
  it("rechnet die Aktivierungs-Kohorte", () => {
    expect(DEFAULT.activation).toEqual({
      signups: 3,
      onboarded: 2,
      withList: 2,
      withCall: 2,
      activeLast7d: 1,
    });
  });

  it("fuellt jeden Tag des Zeitraums", () => {
    const days = DEFAULT.dailyCallers;
    expect(days).toHaveLength(30);
    expect(days[29].date).toBe("2026-09-14");
    expect(days.find((d) => d.date === "2026-09-13")).toEqual({
      date: "2026-09-13",
      callers: 1,
      calls: 1,
    });
  });

  it("gruppiert Abo-Status und blendet fremde Events aus", () => {
    const subs = DEFAULT.subscriptions;
    expect(subs).toMatchObject({
      trialing: 1,
      active: 1,
      atRisk: 0,
      ended: 1,
      monthly: 1,
      yearly: 1,
      founders: 1,
    });
    expect(subs.events).toHaveLength(1);
    expect(subs.events[0]).toMatchObject({ id: "e1", email: "alice@example.com" });
  });
});

describe("buildDashboard: Nutzerliste", () => {
  it("sortiert nach letzter Aktivitaet und vergibt Status", () => {
    const rows = DEFAULT.users.map((u) => `${u.user_id}:${u.status}`);
    expect(rows).toEqual([
      "dave:new",
      "alice:active",
      "carol:stalled",
      "bob:never_called",
      "erin:stalled",
    ]);
  });

  it("traegt Listen, Calls und Abo pro Nutzer ein", () => {
    const carol = DEFAULT.users.find((u) => u.user_id === "carol");
    expect(carol).toMatchObject({
      lists: 1,
      calls: 2,
      callsInRange: 2,
      onboarding_completed: true,
      subscription_status: "active",
    });
    expect(carol?.last_called_at).toBe(ago(12));

    const erin = DEFAULT.users.find((u) => u.user_id === "erin");
    expect(erin).toMatchObject({ calls: 1, callsInRange: 0, subscription_status: "canceled" });
  });
});

describe("buildDashboard: Feedback", () => {
  it("listet nur Eintraege mit Text, neueste zuerst, ohne interne", () => {
    expect(DEFAULT.feedback.map((f) => `${f.email}:${f.text}`)).toEqual([
      "alice@example.com:x",
      "bob@example.com:ok",
      "bob@example.com:x",
    ]);
  });

  it("fasst Sterne-Bewertungen zusammen", () => {
    expect(DEFAULT.ratings).toEqual({ count: 2, average: 4 });
  });
});
