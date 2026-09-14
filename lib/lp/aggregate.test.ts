import { describe, expect, it } from "vitest";

import {
  aggregateBy,
  buildExperimentReport,
  byDevice,
  bySource,
  dailySeries,
  totals,
  type LpEventRow,
} from "./aggregate";
import type { LpExperiment } from "./experiments";

let nextId = 1;
function row(partial: Partial<LpEventRow> & Pick<LpEventRow, "event" | "visitor_hash">): LpEventRow {
  return {
    id: nextId++,
    created_at: "2026-10-02T10:00:00.000Z",
    page: "landing",
    label: null,
    experiment_key: null,
    variant: null,
    session_id: null,
    user_id: null,
    source: "meta",
    utm_campaign: null,
    utm_content: null,
    device: "mobile",
    platform: "ios",
    in_app: true,
    country: "US",
    ...partial,
  };
}

const EXPERIMENT: LpExperiment = {
  key: "hero-01",
  name: "Test",
  hypothesis: "B gewinnt",
  startedAt: "2026-10-01",
  primaryMetric: "signup_started",
  baselineRate: 0.12,
  relativeMde: 0.35,
  variants: [
    { key: "a", label: "A", weight: 1 },
    { key: "b", label: "B", weight: 1 },
  ],
};

describe("aggregateBy / totals", () => {
  it("zaehlt jeden Besucher pro Metrik nur einmal", () => {
    const rows = [
      row({ event: "view", visitor_hash: "v1" }),
      row({ event: "view", visitor_hash: "v1" }), // Reload
      row({ event: "cta_click", visitor_hash: "v1", label: "hero" }),
      row({ event: "cta_click", visitor_hash: "v1", label: "nav" }),
      row({ event: "signup_started", visitor_hash: "v1", label: "email" }),
      row({ event: "signup_started", visitor_hash: "v1", label: "email" }),
      row({ event: "signup_confirmed", visitor_hash: "v1", user_id: "u1" }),
      row({ event: "view", visitor_hash: "v2" }),
    ];
    expect(totals(rows)).toEqual({
      visitors: 2,
      ctaClickers: 1,
      starters: 1,
      confirmed: 1,
    });
  });

  it("gruppiert nach Quelle und Geraet", () => {
    const rows = [
      row({ event: "view", visitor_hash: "v1", source: "meta" }),
      row({ event: "view", visitor_hash: "v2", source: "google", device: "desktop", in_app: false }),
      row({ event: "view", visitor_hash: "v3", source: "meta", in_app: false }),
      row({ event: "cta_click", visitor_hash: "v3", source: "meta", in_app: false }),
    ];
    const sources = Object.fromEntries(bySource(rows).map((s) => [s.key, s.counts.visitors]));
    expect(sources).toEqual({ meta: 2, google: 1, direct: 0, other: 0 });

    const devices = Object.fromEntries(byDevice(rows).map((d) => [d.key, d.counts]));
    expect(devices["mobile-inapp"].visitors).toBe(1);
    expect(devices["mobile"].visitors).toBe(1);
    expect(devices["mobile"].ctaClickers).toBe(1);
    expect(devices["desktop"].visitors).toBe(1);
  });

  it("ignoriert Rows ohne Gruppenschluessel", () => {
    const rows = [row({ event: "view", visitor_hash: "v1" })];
    expect(aggregateBy(rows, () => null).size).toBe(0);
  });
});

describe("dailySeries", () => {
  it("fuellt Luecken und sortiert aufsteigend", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const rows = [
      row({ event: "view", visitor_hash: "v1", created_at: "2026-10-01T08:00:00Z" }),
      row({ event: "view", visitor_hash: "v2", created_at: "2026-10-03T08:00:00Z" }),
    ];
    const series = dailySeries(rows, 3, now);
    expect(series.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(series.map((p) => p.counts.visitors)).toEqual([1, 0, 1]);
  });
});

describe("buildExperimentReport", () => {
  function testRows(): LpEventRow[] {
    const rows: LpEventRow[] = [];
    // A: 200 Besucher, 24 starten. B: 200 Besucher, 48 starten.
    for (let i = 0; i < 200; i++) {
      rows.push(row({ event: "view", visitor_hash: `a${i}`, experiment_key: "hero-01", variant: "a" }));
      rows.push(row({ event: "view", visitor_hash: `b${i}`, experiment_key: "hero-01", variant: "b" }));
      if (i < 24) rows.push(row({ event: "signup_started", visitor_hash: `a${i}`, experiment_key: "hero-01", variant: "a" }));
      if (i < 48) rows.push(row({ event: "signup_started", visitor_hash: `b${i}`, experiment_key: "hero-01", variant: "b" }));
    }
    // Rauschen: Event vor Teststart und mit fremdem Experiment.
    rows.push(row({ event: "view", visitor_hash: "old", experiment_key: "hero-01", variant: "b", created_at: "2026-09-30T23:00:00Z" }));
    rows.push(row({ event: "view", visitor_hash: "other", experiment_key: "hero-00", variant: "b" }));
    return rows;
  }

  it("vergleicht Varianten gegen die Kontrolle auf der Entscheidungsmetrik", () => {
    const report = buildExperimentReport(testRows(), EXPERIMENT, Date.parse("2026-10-05T00:00:00Z"));
    const [a, b] = report.variants;
    expect(a.isControl).toBe(true);
    expect(a.counts.visitors).toBe(200);
    expect(b.counts.visitors).toBe(200);
    expect(a.rate).toBeCloseTo(0.12, 6);
    expect(b.rate).toBeCloseTo(0.24, 6);
    expect(a.comparison).toBeNull();
    expect(b.comparison?.relativeLift).toBeCloseTo(1, 6);
    expect(b.comparison?.pValue).toBeLessThan(0.01);
    expect(b.comparison?.probabilityBBeatsA).toBeGreaterThan(0.99);
  });

  it("rechnet Fortschritt gegen die geplante Stichprobe", () => {
    const report = buildExperimentReport(testRows(), EXPERIMENT, Date.parse("2026-10-05T00:00:00Z"));
    expect(report.daysRunning).toBe(4);
    expect(report.requiredPerVariant).toBeGreaterThan(900);
    expect(report.minVisitors).toBe(200);
    expect(report.progress).toBeCloseTo(200 / report.requiredPerVariant, 6);
  });

  it("liefert leere Varianten ohne Events", () => {
    const report = buildExperimentReport([], EXPERIMENT);
    expect(report.variants.map((v) => v.counts.visitors)).toEqual([0, 0]);
    expect(report.progress).toBe(0);
  });
});
