/**
 * Pure Aggregation der lp_events fuer die Admin-Auswertung — ohne
 * Supabase-/Next-Imports, damit sie in Vitest laeuft. Die Queries dazu
 * liegen in lib/admin/lp-queries.ts.
 *
 * Grundregel: ein Besucher zaehlt pro Metrik hoechstens einmal, egal wie
 * oft er geklickt hat — sonst wuerde ein einzelner Vielklicker eine
 * Variante "gewinnen" lassen.
 */

import { controlVariant, type LpExperiment } from "./experiments";
import type { LpDevice, LpEvent, LpPage, LpSource } from "./shared";
import {
  compareProportions,
  requiredSampleSize,
  type ProportionComparison,
} from "./stats";

export interface LpEventRow {
  id: number;
  created_at: string;
  page: LpPage;
  event: LpEvent;
  label: string | null;
  experiment_key: string | null;
  variant: string | null;
  visitor_hash: string;
  session_id: string | null;
  user_id: string | null;
  source: LpSource;
  utm_campaign: string | null;
  utm_content: string | null;
  device: LpDevice;
  platform: string;
  in_app: boolean;
  country: string | null;
}

export interface FunnelCounts {
  /** Distinct Visitor-Hashes mit view. */
  visitors: number;
  /** Distinct Visitor-Hashes mit cta_click. */
  ctaClickers: number;
  /** Distinct Visitor-Hashes mit signup_started. */
  starters: number;
  /** Distinct User (signup_confirmed). */
  confirmed: number;
}

export function emptyCounts(): FunnelCounts {
  return { visitors: 0, ctaClickers: 0, starters: 0, confirmed: 0 };
}

type Buckets = {
  view: Set<string>;
  cta: Set<string>;
  start: Set<string>;
  confirmed: Set<string>;
};

export function aggregateBy<K extends string>(
  rows: LpEventRow[],
  keyOf: (row: LpEventRow) => K | null,
): Map<K, FunnelCounts> {
  const buckets = new Map<K, Buckets>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    let b = buckets.get(key);
    if (!b) {
      b = { view: new Set(), cta: new Set(), start: new Set(), confirmed: new Set() };
      buckets.set(key, b);
    }
    switch (row.event) {
      case "view":
        b.view.add(row.visitor_hash);
        break;
      case "cta_click":
        b.cta.add(row.visitor_hash);
        break;
      case "signup_started":
        b.start.add(row.visitor_hash);
        break;
      case "signup_confirmed":
        b.confirmed.add(row.user_id ?? row.visitor_hash);
        break;
    }
  }
  const out = new Map<K, FunnelCounts>();
  for (const [key, b] of buckets) {
    out.set(key, {
      visitors: b.view.size,
      ctaClickers: b.cta.size,
      starters: b.start.size,
      confirmed: b.confirmed.size,
    });
  }
  return out;
}

export function totals(rows: LpEventRow[]): FunnelCounts {
  return aggregateBy(rows, () => "all" as const).get("all") ?? emptyCounts();
}

export const SOURCE_ORDER: LpSource[] = ["meta", "google", "direct", "other"];

export function bySource(
  rows: LpEventRow[],
): Array<{ key: LpSource; counts: FunnelCounts }> {
  const map = aggregateBy(rows, (r) => r.source);
  return SOURCE_ORDER.map((key) => ({ key, counts: map.get(key) ?? emptyCounts() }));
}

export type DeviceKey = "mobile-inapp" | "mobile" | "desktop";
export const DEVICE_ORDER: Array<{ key: DeviceKey; label: string }> = [
  { key: "mobile-inapp", label: "Mobile, In-App-Browser" },
  { key: "mobile", label: "Mobile, Browser" },
  { key: "desktop", label: "Desktop" },
];

export function byDevice(
  rows: LpEventRow[],
): Array<{ key: DeviceKey; counts: FunnelCounts }> {
  const map = aggregateBy<DeviceKey>(rows, (r) =>
    r.device === "desktop" ? "desktop" : r.in_app ? "mobile-inapp" : "mobile",
  );
  return DEVICE_ORDER.map(({ key }) => ({ key, counts: map.get(key) ?? emptyCounts() }));
}

export interface DailyPoint {
  date: string;
  counts: FunnelCounts;
}

/** Ein Punkt pro UTC-Tag ueber die letzten `days` Tage, Luecken gefuellt. */
export function dailySeries(
  rows: LpEventRow[],
  days: number,
  now: number = Date.now(),
): DailyPoint[] {
  const map = aggregateBy(rows, (r) => r.created_at.slice(0, 10));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, counts: map.get(date) ?? emptyCounts() });
  }
  return out;
}

// ----------------------------------------------------------------
// Experiment-Report
// ----------------------------------------------------------------

export interface VariantReport {
  key: string;
  label: string;
  isControl: boolean;
  counts: FunnelCounts;
  /** Erfolge der primaryMetric (Uniques). */
  successes: number;
  rate: number;
  /** Vergleich gegen die Kontrolle; null fuer die Kontrolle selbst. */
  comparison: ProportionComparison | null;
}

export interface ExperimentReport {
  experiment: LpExperiment;
  daysRunning: number;
  requiredPerVariant: number;
  /** Kleinste Besucherzahl ueber alle Varianten — der Engpass. */
  minVisitors: number;
  /** 0..1, Anteil der geplanten Stichprobe (kleinste Variante). */
  progress: number;
  variants: VariantReport[];
}

export function successesFor(
  counts: FunnelCounts,
  metric: LpExperiment["primaryMetric"],
): number {
  switch (metric) {
    case "cta_click":
      return counts.ctaClickers;
    case "signup_started":
      return counts.starters;
    case "signup_confirmed":
      return counts.confirmed;
  }
}

export function buildExperimentReport(
  rows: LpEventRow[],
  experiment: LpExperiment,
  now: number = Date.now(),
): ExperimentReport {
  const startMs = new Date(`${experiment.startedAt}T00:00:00Z`).getTime();
  const inTest = rows.filter(
    (r) =>
      r.experiment_key === experiment.key &&
      r.variant !== null &&
      new Date(r.created_at).getTime() >= startMs,
  );
  const map = aggregateBy(inTest, (r) => r.variant);
  const control = controlVariant(experiment);
  const controlCounts = map.get(control.key) ?? emptyCounts();
  const controlSuccesses = successesFor(controlCounts, experiment.primaryMetric);

  const variants: VariantReport[] = experiment.variants.map((v) => {
    const counts = map.get(v.key) ?? emptyCounts();
    const successes = successesFor(counts, experiment.primaryMetric);
    const isControl = v.key === control.key;
    return {
      key: v.key,
      label: v.label,
      isControl,
      counts,
      successes,
      rate: counts.visitors > 0 ? successes / counts.visitors : 0,
      comparison: isControl
        ? null
        : compareProportions(
            controlSuccesses,
            controlCounts.visitors,
            successes,
            counts.visitors,
          ),
    };
  });

  const requiredPerVariant = requiredSampleSize(
    experiment.baselineRate,
    experiment.relativeMde,
  );
  const minVisitors = Math.min(...variants.map((v) => v.counts.visitors));
  const progress = Number.isFinite(requiredPerVariant)
    ? Math.min(1, minVisitors / requiredPerVariant)
    : 0;
  const daysRunning = Math.max(0, Math.floor((now - startMs) / 86_400_000));

  return { experiment, daysRunning, requiredPerVariant, minVisitors, progress, variants };
}
