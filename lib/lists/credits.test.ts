import { describe, expect, it } from "vitest";
import {
  clampRequestedSize,
  DEFAULT_LIST_SIZE,
  MAX_LIST_SIZE,
  resolveStoredMaxSize,
  SIGNUP_CREDITS,
} from "./credits";

describe("clampRequestedSize", () => {
  it("klammert auf Kontostand und Hard-Cap", () => {
    expect(clampRequestedSize(250, 1000)).toBe(250);
    expect(clampRequestedSize(9999, 1000)).toBe(MAX_LIST_SIZE);
    expect(clampRequestedSize(250, 40)).toBe(40);
    expect(clampRequestedSize(10, 40)).toBe(10);
  });

  it("liefert null bei leerem Konto", () => {
    expect(clampRequestedSize(250, 0)).toBeNull();
    expect(clampRequestedSize(250, -5)).toBeNull();
  });

  it("faellt bei fehlender/kaputter Eingabe auf den Default zurueck", () => {
    expect(clampRequestedSize(undefined, 1000)).toBe(DEFAULT_LIST_SIZE);
    expect(clampRequestedSize("250", 1000)).toBe(DEFAULT_LIST_SIZE);
    expect(clampRequestedSize(NaN, 1000)).toBe(DEFAULT_LIST_SIZE);
    expect(clampRequestedSize(undefined, 30)).toBe(30);
  });

  it("rundet ab und erzwingt mindestens 1", () => {
    expect(clampRequestedSize(12.9, 1000)).toBe(12);
    expect(clampRequestedSize(0, 1000)).toBe(1);
    expect(clampRequestedSize(-3, 1000)).toBe(1);
  });
});

describe("resolveStoredMaxSize", () => {
  it("liest gespeicherte Werte und klammert auf das Hard-Cap", () => {
    expect(resolveStoredMaxSize(120)).toBe(120);
    expect(resolveStoredMaxSize(9999)).toBe(MAX_LIST_SIZE);
    expect(resolveStoredMaxSize(0)).toBe(1);
  });

  it("Alt-Jobs ohne max_size bekommen den Default (250er-Versprechen)", () => {
    expect(resolveStoredMaxSize(undefined)).toBe(DEFAULT_LIST_SIZE);
    expect(resolveStoredMaxSize(null)).toBe(DEFAULT_LIST_SIZE);
    expect(resolveStoredMaxSize("abc")).toBe(DEFAULT_LIST_SIZE);
  });
});

describe("Konstanten-Vertrag", () => {
  it("Signup-Credits decken das Default-Listen-Versprechen", () => {
    // Jan-Entscheidung 2026-08-05: 250 Free-Credits = eine volle
    // Default-Liste. Wer eine der beiden Zahlen aendert, soll hier
    // bewusst vorbeikommen.
    expect(SIGNUP_CREDITS).toBe(250);
    expect(DEFAULT_LIST_SIZE).toBe(250);
    expect(MAX_LIST_SIZE).toBe(500);
  });
});
