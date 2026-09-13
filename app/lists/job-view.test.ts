import { describe, expect, it } from "vitest";
import {
  FAILED_CARD_WINDOW_MS,
  failedCardMessage,
  failureMessage,
  statusLine,
} from "./job-view";

/**
 * Statuszeile der Building-Kachel (seit 2026-09-13 der einzige
 * Ladezustand des Generators): eine Zeile, Prioritaet nach dem, was
 * gerade wirklich passiert — E-Mail-Suche > Nachschlag-Welle >
 * Folge-Lauf > erste Welle.
 */
describe("statusLine", () => {
  it("erste Welle: Scan-Zeile mit Stadt", () => {
    expect(statusLine({ city: "Köln" })).toBe(
      "Scanning Google Maps in Köln…",
    );
    expect(statusLine({})).toBe("Scanning Google Maps in your area…");
  });

  it("Folge-Lauf: Coverage-Zeile schlaegt die Scan-Zeile", () => {
    expect(
      statusLine({
        city: "Köln",
        coverage: { covered_before: 5, visited_before: 12, total: 60 },
      }),
    ).toBe("Continuing in Köln — 12 of 60 areas searched so far.");
  });

  it("Folge-Lauf ohne besuchte Gebiete: Scan-Zeile", () => {
    expect(
      statusLine({
        city: "Köln",
        coverage: { covered_before: 0, visited_before: 0, total: 60 },
      }),
    ).toBe("Scanning Google Maps in Köln…");
  });

  it("Welle 2+: Wellen-Zeile schlaegt Coverage", () => {
    expect(
      statusLine({
        city: "Köln",
        coverage: { covered_before: 5, visited_before: 12, total: 60 },
        wave: 2,
        max_waves: 3,
        waves_done: [{ wave: 1, delivered: 18 }],
      }),
    ).toBe("Round 2 of up to 3 — 18 leads so far, searching more areas.");
  });

  it("E-Mail-Suche schlaegt alles", () => {
    expect(
      statusLine({
        city: "Köln",
        wave: 3,
        max_waves: 3,
        waves_done: [
          { wave: 1, delivered: 18 },
          { wave: 2, delivered: 10 },
        ],
        phase: "enrich",
        enrich: { domains: 20 },
      }),
    ).toBe("28 leads found — looking up email addresses now.");
    expect(statusLine({ phase: "enrich", enrich: { domains: 3 } })).toBe(
      "Leads found — looking up email addresses now.",
    );
  });
});

describe("failedCardMessage", () => {
  const now = Date.parse("2026-09-13T12:00:00Z");
  const fresh = new Date(now - 60_000).toISOString();
  const stale = new Date(now - FAILED_CARD_WINDOW_MS - 1).toISOString();

  it("frischer Fehlschlag → Kachel-Text", () => {
    expect(
      failedCardMessage(
        { status: "failed", error: "timeout", params: {}, createdAt: fresh },
        now,
      ),
    ).toMatch(/took too long/);
  });

  it("alter Fehlschlag und andere Stati → null", () => {
    expect(
      failedCardMessage(
        { status: "failed", error: "timeout", params: {}, createdAt: stale },
        now,
      ),
    ).toBeNull();
    expect(
      failedCardMessage(
        { status: "ready", error: null, params: {}, createdAt: fresh },
        now,
      ),
    ).toBeNull();
    expect(
      failedCardMessage(
        { status: "pending", error: null, params: {}, createdAt: fresh },
        now,
      ),
    ).toBeNull();
  });
});

describe("failureMessage", () => {
  it("braucht nur error + params (Server-Rows auf /lists)", () => {
    expect(failureMessage({ error: "timeout", params: {} })).toMatch(
      /took too long/,
    );
    expect(
      failureMessage({ error: "no_results", params: { website: "without" } }),
    ).toMatch(/website filter/);
    expect(failureMessage({ error: "no_results", params: {} })).toMatch(
      /broader industry/,
    );
    expect(failureMessage({ error: "insert_failed", params: {} })).toMatch(
      /Something went wrong/,
    );
  });
});
