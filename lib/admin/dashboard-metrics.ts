import { isInternalEmail } from "./internal";

/**
 * Reine Auswertungs-Funktionen fuer die Admin-Uebersicht (/[secret]).
 *
 * Bekommt die Roh-Rows aus Supabase (lib/admin/queries.ts laedt sie)
 * und rechnet daraus alles, was die Seite zeigt: Kennzahlen mit
 * Vorperiode, Sign-ups pro Woche, eine Nutzerliste mit Status und das
 * Feedback. Kein I/O, keine Zeitzone ausser UTC (bewusst, wie ueberall
 * im Admin), damit sich das Ganze in Vitest mit festem `now` durchtesten
 * laesst.
 *
 * Interne Accounts (lib/admin/internal.ts) werden vor jeder Rechnung
 * herausgefiltert, es sei denn `includeInternal` ist gesetzt.
 *
 * `weeklySignups`, `activation`, `dailyCallers` und `subscriptions`
 * rendert die Seite seit 2026-09-14 nicht mehr (zu viel Flaeche fuer zu
 * kleine Zahlen), bleiben aber berechnet und getestet, damit sie ohne
 * Umbau zurueckkommen. Die Seite zeigt den Funnel als fuenf Kacheln:
 * Sign-up, erste Liste, erster Call (je im Zeitraum), Trial, Zahlend
 * (Stand jetzt).
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const WEEKS_SHOWN = 12;
const STALLED_AFTER_DAYS = 7;
/** Frische Sign-ups gelten noch nicht als "nie gecallt". */
const NEVER_CALLED_GRACE_DAYS = 2;
const USERS_LIMIT = 100;
const FEEDBACK_LIMIT = 20;
const SUBSCRIPTION_EVENTS_LIMIT = 10;

// ----------------------------------------------------------------
// Eingabe
// ----------------------------------------------------------------

export type DashboardRange = 7 | 30 | 90;
export const DASHBOARD_RANGES: DashboardRange[] = [7, 30, 90];

export function parseDashboardRange(raw: string | undefined): DashboardRange {
  if (raw === "7") return 7;
  if (raw === "90") return 90;
  return 30;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  subscription_status: SubscriptionStatus | null;
  subscription_plan: "monthly" | "yearly" | null;
  plan_type: "standard" | "founder" | null;
}

export interface CallRow {
  user_id: string;
  called_at: string;
  outcome: string;
}

export interface ListRow {
  user_id: string;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  email: string | null;
  category: "bug" | "idea" | "rating";
  /** Nur im Rating-Zweig gesetzt (Migration 0050). */
  rating: number | null;
  text: string | null;
  app_version: string | null;
  /** Herkunft (Migration 0055): App-Feedback-Seite oder Web-Generator. */
  source: "app" | "web_generator";
  created_at: string;
}

export interface SubscriptionEventRow {
  id: string;
  event_type: string;
  app_user_id: string;
  product_id: string | null;
  received_at: string;
}

export interface DashboardSource {
  profiles: ProfileRow[];
  calls: CallRow[];
  lists: ListRow[];
  feedback: FeedbackRow[];
  /** Nur PRODUCTION-Events, neueste zuerst (Loader filtert Sandbox raus). */
  subscriptionEvents: SubscriptionEventRow[];
}

export interface DashboardOptions {
  rangeDays: DashboardRange;
  includeInternal: boolean;
  /** Testbarkeit: fester Zeitpunkt statt Date.now(). */
  now?: number;
}

// ----------------------------------------------------------------
// Ausgabe
// ----------------------------------------------------------------

export interface KpiValue {
  current: number;
  /** null = kein Vergleich (Momentaufnahme). */
  previous: number | null;
}

export interface DashboardKpis {
  signups: KpiValue;
  /** Nutzer, deren erste eigene Liste (ohne Beispiel-Liste) in den
   *  Zeitraum faellt. */
  firstList: KpiValue;
  /** Nutzer, deren allererster Call in den Zeitraum faellt. */
  activated: KpiValue;
  activeCallers: KpiValue;
  /** Momentaufnahme aus profiles.subscription_status. */
  paying: number;
  trialing: number;
}

export interface WeeklySignupPoint {
  /** Montag der Woche, YYYY-MM-DD (UTC). */
  weekStart: string;
  signups: number;
  /** Davon mit mindestens einem Call, egal wann. */
  activated: number;
}

export interface ActivationFunnel {
  signups: number;
  onboarded: number;
  withList: number;
  withCall: number;
  activeLast7d: number;
}

export interface DailyCallerPoint {
  date: string; // YYYY-MM-DD
  callers: number;
  calls: number;
}

export interface SubscriptionEventView {
  id: string;
  event_type: string;
  product_id: string | null;
  received_at: string;
  email: string | null;
}

export interface SubscriptionSummary {
  trialing: number;
  active: number;
  /** past_due, unpaid, incomplete */
  atRisk: number;
  /** canceled, incomplete_expired, paused */
  ended: number;
  /** Unter trialing + active. */
  monthly: number;
  yearly: number;
  founders: number;
  events: SubscriptionEventView[];
}

/**
 * active = Call in den letzten 7 Tagen, stalled = laenger her,
 * never_called = mindestens 2 Tage dabei ohne Call, new = juenger als
 * 2 Tage ohne Call (noch keine Aussage moeglich).
 */
export type UserStatus = "active" | "stalled" | "never_called" | "new";

export interface UserRow {
  user_id: string;
  email: string | null;
  name: string;
  created_at: string;
  onboarding_completed: boolean;
  lists: number;
  /** Calls gesamt. */
  calls: number;
  callsInRange: number;
  last_called_at: string | null;
  subscription_status: SubscriptionStatus | null;
  status: UserStatus;
}

export interface RatingSummary {
  count: number;
  average: number | null;
}

export interface DashboardData {
  rangeDays: DashboardRange;
  includeInternal: boolean;
  /** Wie viele Accounts der Intern-Filter gerade ausblendet. */
  internalHidden: number;
  kpis: DashboardKpis;
  weeklySignups: WeeklySignupPoint[];
  activation: ActivationFunnel;
  dailyCallers: DailyCallerPoint[];
  subscriptions: SubscriptionSummary;
  /** Alle sichtbaren Nutzer, nach letzter Aktivitaet (Call, sonst Sign-up). */
  users: UserRow[];
  /** Nur Eintraege mit Text; Sterne ohne Kommentar landen in `ratings`. */
  feedback: FeedbackRow[];
  ratings: RatingSummary;
}

// ----------------------------------------------------------------
// Helfer
// ----------------------------------------------------------------

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Montag 00:00 UTC der Woche, in die `ms` faellt. */
export function startOfIsoWeekUtc(ms: number): number {
  const d = new Date(ms);
  const sinceMonday = (d.getUTCDay() + 6) % 7; // So=0 → 6, Mo=1 → 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday);
}

interface UserStats {
  callsTotal: number;
  callsInRange: number;
  firstCallMs: number | null;
  lastCallMs: number | null;
  lists: number;
  firstListMs: number | null;
}

function emptyStats(): UserStats {
  return {
    callsTotal: 0,
    callsInRange: 0,
    firstCallMs: null,
    lastCallMs: null,
    lists: 0,
    firstListMs: null,
  };
}

const AT_RISK_STATUSES = new Set<SubscriptionStatus>(["past_due", "unpaid", "incomplete"]);
const ENDED_STATUSES = new Set<SubscriptionStatus>(["canceled", "incomplete_expired", "paused"]);

// ----------------------------------------------------------------
// Hauptfunktion
// ----------------------------------------------------------------

export function buildDashboard(source: DashboardSource, opts: DashboardOptions): DashboardData {
  const now = opts.now ?? Date.now();
  const rangeMs = opts.rangeDays * DAY;
  const rangeStart = now - rangeMs;
  const prevStart = rangeStart - rangeMs;
  const sevenDaysAgo = now - 7 * DAY;

  const inRange = (ms: number) => ms >= rangeStart;
  const inPrev = (ms: number) => ms >= prevStart && ms < rangeStart;

  // --- Intern-Filter ---------------------------------------------
  const profiles = opts.includeInternal
    ? source.profiles
    : source.profiles.filter((p) => !isInternalEmail(p.email));
  const internalHidden = source.profiles.length - profiles.length;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const calls = source.calls.filter((c) => profileById.has(c.user_id));
  const lists = source.lists.filter((l) => profileById.has(l.user_id));
  const feedback = opts.includeInternal
    ? source.feedback
    : source.feedback.filter((f) => !isInternalEmail(f.email));

  // --- Pro-Nutzer-Aggregate --------------------------------------
  const stats = new Map<string, UserStats>();
  const statsFor = (userId: string): UserStats => {
    let s = stats.get(userId);
    if (!s) {
      s = emptyStats();
      stats.set(userId, s);
    }
    return s;
  };

  const callersCurrent = new Set<string>();
  const callersPrevious = new Set<string>();
  const callsByDay = new Map<string, { callers: Set<string>; calls: number }>();

  for (const call of calls) {
    const ms = Date.parse(call.called_at);
    const s = statsFor(call.user_id);
    s.callsTotal += 1;
    if (s.firstCallMs === null || ms < s.firstCallMs) s.firstCallMs = ms;
    if (s.lastCallMs === null || ms > s.lastCallMs) s.lastCallMs = ms;

    if (inRange(ms)) {
      s.callsInRange += 1;
      callersCurrent.add(call.user_id);
      const key = dateKey(ms);
      let bucket = callsByDay.get(key);
      if (!bucket) {
        bucket = { callers: new Set(), calls: 0 };
        callsByDay.set(key, bucket);
      }
      bucket.callers.add(call.user_id);
      bucket.calls += 1;
    } else if (inPrev(ms)) {
      callersPrevious.add(call.user_id);
    }
  }
  for (const list of lists) {
    const ms = Date.parse(list.created_at);
    const s = statsFor(list.user_id);
    s.lists += 1;
    if (s.firstListMs === null || ms < s.firstListMs) s.firstListMs = ms;
  }

  // --- Kennzahlen --------------------------------------------------
  const signups: KpiValue = { current: 0, previous: 0 };
  const firstList: KpiValue = { current: 0, previous: 0 };
  const activated: KpiValue = { current: 0, previous: 0 };
  let paying = 0;
  let trialing = 0;
  const countFirst = (ms: number | null, kpi: KpiValue) => {
    if (ms === null) return;
    if (inRange(ms)) kpi.current += 1;
    else if (inPrev(ms)) kpi.previous = (kpi.previous ?? 0) + 1;
  };
  for (const p of profiles) {
    const s = stats.get(p.id);
    countFirst(Date.parse(p.created_at), signups);
    countFirst(s?.firstListMs ?? null, firstList);
    countFirst(s?.firstCallMs ?? null, activated);

    if (p.subscription_status === "active") paying += 1;
    else if (p.subscription_status === "trialing") trialing += 1;
  }

  const kpis: DashboardKpis = {
    signups,
    firstList,
    activated,
    activeCallers: { current: callersCurrent.size, previous: callersPrevious.size },
    paying,
    trialing,
  };

  // --- Sign-ups pro Woche ------------------------------------------
  const firstWeekStart = startOfIsoWeekUtc(now) - (WEEKS_SHOWN - 1) * WEEK;
  const weeklySignups: WeeklySignupPoint[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => ({
    weekStart: dateKey(firstWeekStart + i * WEEK),
    signups: 0,
    activated: 0,
  }));
  for (const p of profiles) {
    const idx = Math.floor((Date.parse(p.created_at) - firstWeekStart) / WEEK);
    if (idx < 0 || idx >= WEEKS_SHOWN) continue;
    weeklySignups[idx].signups += 1;
    if ((stats.get(p.id)?.callsTotal ?? 0) > 0) weeklySignups[idx].activated += 1;
  }

  // --- Aktivierungs-Kohorte (derzeit nicht gerendert) --------------
  const activation: ActivationFunnel = {
    signups: 0,
    onboarded: 0,
    withList: 0,
    withCall: 0,
    activeLast7d: 0,
  };
  for (const p of profiles) {
    if (!inRange(Date.parse(p.created_at))) continue;
    const s = stats.get(p.id);
    activation.signups += 1;
    if (p.onboarding_completed) activation.onboarded += 1;
    if ((s?.lists ?? 0) > 0) activation.withList += 1;
    if ((s?.callsTotal ?? 0) > 0) activation.withCall += 1;
    if (s?.lastCallMs !== null && s?.lastCallMs !== undefined && s.lastCallMs >= sevenDaysAgo) {
      activation.activeLast7d += 1;
    }
  }

  // --- Caller pro Tag (derzeit nicht gerendert) --------------------
  const dailyCallers: DailyCallerPoint[] = [];
  for (let i = opts.rangeDays - 1; i >= 0; i--) {
    const key = dateKey(now - i * DAY);
    const bucket = callsByDay.get(key);
    dailyCallers.push({
      date: key,
      callers: bucket ? bucket.callers.size : 0,
      calls: bucket ? bucket.calls : 0,
    });
  }

  // --- Abos (derzeit nicht gerendert) -------------------------------
  const subscriptions: SubscriptionSummary = {
    trialing: 0,
    active: 0,
    atRisk: 0,
    ended: 0,
    monthly: 0,
    yearly: 0,
    founders: 0,
    events: [],
  };
  for (const p of profiles) {
    const status = p.subscription_status;
    if (status === "trialing" || status === "active") {
      if (status === "trialing") subscriptions.trialing += 1;
      else subscriptions.active += 1;
      if (p.subscription_plan === "monthly") subscriptions.monthly += 1;
      else if (p.subscription_plan === "yearly") subscriptions.yearly += 1;
    } else if (status && AT_RISK_STATUSES.has(status)) {
      subscriptions.atRisk += 1;
    } else if (status && ENDED_STATUSES.has(status)) {
      subscriptions.ended += 1;
    }
    if (p.plan_type === "founder") subscriptions.founders += 1;
  }
  subscriptions.events = source.subscriptionEvents
    .map((e) => ({
      id: e.id,
      event_type: e.event_type,
      product_id: e.product_id,
      received_at: e.received_at,
      email: profileById.get(e.app_user_id)?.email ?? null,
    }))
    .filter((e) => opts.includeInternal || !isInternalEmail(e.email))
    .sort((a, b) => b.received_at.localeCompare(a.received_at))
    .slice(0, SUBSCRIPTION_EVENTS_LIMIT);

  // --- Nutzerliste --------------------------------------------------
  const users: Array<UserRow & { activityMs: number }> = profiles.map((p) => {
    const s = stats.get(p.id);
    const callsTotal = s?.callsTotal ?? 0;
    const lastMs = s?.lastCallMs ?? null;
    const createdMs = Date.parse(p.created_at);

    let status: UserStatus;
    if (callsTotal === 0) {
      status = now - createdMs < NEVER_CALLED_GRACE_DAYS * DAY ? "new" : "never_called";
    } else if (lastMs !== null && lastMs < now - STALLED_AFTER_DAYS * DAY) {
      status = "stalled";
    } else {
      status = "active";
    }

    return {
      user_id: p.id,
      email: p.email,
      name: p.name ?? "",
      created_at: p.created_at,
      onboarding_completed: p.onboarding_completed,
      lists: s?.lists ?? 0,
      calls: callsTotal,
      callsInRange: s?.callsInRange ?? 0,
      last_called_at: lastMs === null ? null : new Date(lastMs).toISOString(),
      subscription_status: p.subscription_status,
      status,
      activityMs: lastMs ?? createdMs,
    };
  });
  users.sort((a, b) => b.activityMs - a.activityMs);

  // --- Feedback -----------------------------------------------------
  const sortedFeedback = feedback
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const withText = sortedFeedback
    .filter((f) => (f.text ?? "").trim().length > 0)
    .slice(0, FEEDBACK_LIMIT);
  const ratingValues = sortedFeedback
    .filter((f) => f.category === "rating" && f.rating != null)
    .map((f) => f.rating as number);
  const ratings: RatingSummary = {
    count: ratingValues.length,
    average:
      ratingValues.length === 0
        ? null
        : ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length,
  };

  return {
    rangeDays: opts.rangeDays,
    includeInternal: opts.includeInternal,
    internalHidden,
    kpis,
    weeklySignups,
    activation,
    dailyCallers,
    subscriptions,
    users: users.slice(0, USERS_LIMIT).map(({ activityMs: _activityMs, ...row }) => row),
    feedback: withText,
    ratings,
  };
}
