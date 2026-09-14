import { describe, expect, it } from "vitest";

import {
  compareProportions,
  normalCdf,
  normalQuantile,
  requiredSampleSize,
} from "./stats";

describe("normalCdf / normalQuantile", () => {
  it("trifft die Standardwerte", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 2);
    expect(normalQuantile(0.8)).toBeCloseTo(0.8416, 3);
  });
});

describe("requiredSampleSize", () => {
  it("liegt in der Groessenordnung der Standard-Rechner", () => {
    // 3 % Basis, +20 % relativ → rund 14.000 pro Variante
    const a = requiredSampleSize(0.03, 0.2);
    expect(a).toBeGreaterThan(12_000);
    expect(a).toBeLessThan(16_000);
    // 12 % Basis, +35 % relativ → rund 1.100 pro Variante
    const b = requiredSampleSize(0.12, 0.35);
    expect(b).toBeGreaterThan(900);
    expect(b).toBeLessThan(1_300);
  });

  it("wird mit groesserem Effekt kleiner", () => {
    expect(requiredSampleSize(0.1, 0.5)).toBeLessThan(requiredSampleSize(0.1, 0.2));
  });

  it("gibt Infinity bei unsinnigen Parametern", () => {
    expect(requiredSampleSize(0, 0.2)).toBe(Infinity);
    expect(requiredSampleSize(0.1, 0)).toBe(Infinity);
  });
});

describe("compareProportions", () => {
  it("liefert null-Werte unter 20 Besuchern pro Variante", () => {
    const r = compareProportions(2, 10, 5, 10);
    expect(r.pValue).toBeNull();
    expect(r.probabilityBBeatsA).toBeNull();
    expect(r.relativeLift).toBeCloseTo(1.5, 6);
  });

  it("erkennt einen klaren Unterschied", () => {
    const r = compareProportions(50, 500, 90, 500);
    expect(r.rateA).toBeCloseTo(0.1, 6);
    expect(r.rateB).toBeCloseTo(0.18, 6);
    expect(r.pValue).not.toBeNull();
    expect(r.pValue!).toBeLessThan(0.01);
    expect(r.probabilityBBeatsA!).toBeGreaterThan(0.99);
  });

  it("ist bei gleichen Raten unentschieden", () => {
    const r = compareProportions(60, 500, 60, 500);
    expect(r.pValue).toBeCloseTo(1, 6);
    expect(r.probabilityBBeatsA).toBeCloseTo(0.5, 6);
    expect(r.relativeLift).toBeCloseTo(0, 6);
  });

  it("hat keinen Lift ohne Kontroll-Erfolge", () => {
    expect(compareProportions(0, 100, 5, 100).relativeLift).toBeNull();
  });
});
