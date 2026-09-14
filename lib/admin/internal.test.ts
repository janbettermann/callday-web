import { describe, expect, it } from "vitest";

import { isInternalEmail } from "./internal";

describe("isInternalEmail", () => {
  it("behandelt fehlende oder kaputte Adressen als intern", () => {
    expect(isInternalEmail(null)).toBe(true);
    expect(isInternalEmail(undefined)).toBe(true);
    expect(isInternalEmail("")).toBe(true);
    expect(isInternalEmail("kein-at-zeichen")).toBe(true);
  });

  it("erkennt Jans Adressen inklusive Plus-Tags und Zweitkonto", () => {
    expect(isInternalEmail("jan.bettermann11@gmail.com")).toBe(true);
    expect(isInternalEmail("jan.bettermann11+lists-e2e@gmail.com")).toBe(true);
    expect(isInternalEmail("Jan.Bettermann11+42@GMAIL.com")).toBe(true);
    expect(isInternalEmail("jan.bettermann7@gmail.com")).toBe(true);
  });

  it("erkennt Review- und Testkonten auf der eigenen Domain", () => {
    expect(isInternalEmail("review@callday.io")).toBe(true);
    expect(isInternalEmail("zoom-review@callday.io")).toBe(true);
    expect(isInternalEmail("tester@callday.io")).toBe(true);
  });

  it("laesst echte Nutzer durch, auch mit Plus-Tag oder Apple-Relay", () => {
    expect(isInternalEmail("lennartwachter@gmail.com")).toBe(false);
    expect(isInternalEmail("someone+news@outlook.com")).toBe(false);
    expect(isInternalEmail("cw4fdmw4zm@privaterelay.appleid.com")).toBe(false);
    expect(isInternalEmail("jan@example.com")).toBe(false);
  });
});
