import { describe, expect, it } from "vitest";

import {
  deriveSource,
  hashToUnit,
  parseLpUserAgent,
  pickUtm,
  pickVariant,
  readOverride,
} from "./shared";

const VARIANTS = [
  { key: "a", label: "A", weight: 1 },
  { key: "b", label: "B", weight: 1 },
];

describe("pickVariant", () => {
  it("teilt 50:50 nach dem Bucket-Wert", () => {
    expect(pickVariant(0, VARIANTS).key).toBe("a");
    expect(pickVariant(0.49, VARIANTS).key).toBe("a");
    expect(pickVariant(0.5, VARIANTS).key).toBe("b");
    expect(pickVariant(0.999, VARIANTS).key).toBe("b");
  });

  it("respektiert Gewichte", () => {
    const weighted = [
      { key: "a", label: "A", weight: 3 },
      { key: "b", label: "B", weight: 1 },
    ];
    expect(pickVariant(0.74, weighted).key).toBe("a");
    expect(pickVariant(0.76, weighted).key).toBe("b");
  });

  it("ist ueber viele Hashes annaehernd gleichverteilt", () => {
    // Deterministische Pseudo-Hashes aus mulberry32 (32-Bit-sauber via
    // Math.imul), damit der Test reproduzierbar bleibt.
    let seed = 12345;
    const next = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) {
      const hex = next().toString(16).padStart(8, "0");
      counts[pickVariant(hashToUnit(hex), VARIANTS).key as "a" | "b"] += 1;
    }
    expect(Math.abs(counts.a - counts.b)).toBeLessThan(400);
  });
});

describe("hashToUnit", () => {
  it("liegt in [0, 1)", () => {
    expect(hashToUnit("00000000ff")).toBe(0);
    expect(hashToUnit("ffffffff")).toBeLessThan(1);
    expect(hashToUnit("80000000")).toBeCloseTo(0.5, 6);
    expect(hashToUnit("zz")).toBe(0);
  });
});

describe("readOverride", () => {
  it("akzeptiert nur bekannte Varianten", () => {
    expect(readOverride("b", VARIANTS)).toBe("b");
    expect(readOverride(["a", "b"], VARIANTS)).toBe("a");
    expect(readOverride("c", VARIANTS)).toBeNull();
    expect(readOverride(undefined, VARIANTS)).toBeNull();
  });
});

describe("deriveSource", () => {
  it("UTM schlaegt Referrer", () => {
    expect(deriveSource("ig", "google.com", false)).toBe("meta");
    expect(deriveSource("google", "instagram.com", false)).toBe("google");
    expect(deriveSource("newsletter", null, false)).toBe("other");
  });

  it("fbclid ohne UTM ist Meta", () => {
    expect(deriveSource(null, null, true)).toBe("meta");
  });

  it("leitet aus dem Referrer ab", () => {
    expect(deriveSource(null, "l.instagram.com", false)).toBe("meta");
    expect(deriveSource(null, "lm.facebook.com", false)).toBe("meta");
    expect(deriveSource(null, "www.google.de", false)).toBe("google");
    expect(deriveSource(null, "www.google.co.uk", false)).toBe("google");
    expect(deriveSource(null, "duckduckgo.com", false)).toBe("other");
    expect(deriveSource(null, null, false)).toBe("direct");
  });
});

describe("parseLpUserAgent", () => {
  const IG_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 334.0.4.32.98";
  const SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const CHROME_WIN =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const FB_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]";

  it("erkennt Instagram auf dem iPhone als In-App", () => {
    expect(parseLpUserAgent(IG_IOS)).toEqual({
      device: "mobile",
      platform: "ios",
      inApp: true,
      isBot: false,
    });
  });

  it("erkennt Safari iOS als Mobile ohne In-App", () => {
    expect(parseLpUserAgent(SAFARI_IOS).inApp).toBe(false);
    expect(parseLpUserAgent(SAFARI_IOS).platform).toBe("ios");
  });

  it("erkennt Facebook auf Android", () => {
    const info = parseLpUserAgent(FB_ANDROID);
    expect(info.platform).toBe("android");
    expect(info.inApp).toBe(true);
  });

  it("erkennt Desktop und Bots", () => {
    expect(parseLpUserAgent(CHROME_WIN).device).toBe("desktop");
    expect(parseLpUserAgent("facebookexternalhit/1.1").isBot).toBe(true);
    expect(parseLpUserAgent("").isBot).toBe(true);
    expect(parseLpUserAgent(CHROME_WIN).isBot).toBe(false);
  });
});

describe("pickUtm", () => {
  it("nimmt nur UTM-Keys und kappt lange Werte", () => {
    const utm = pickUtm({
      utm_source: " meta ",
      utm_campaign: "x".repeat(200),
      fbclid: "abc",
      utm_medium: "",
    });
    expect(utm.utm_source).toBe("meta");
    expect(utm.utm_campaign?.length).toBe(120);
    expect(utm.utm_medium).toBeUndefined();
    expect("fbclid" in utm).toBe(false);
  });
});
