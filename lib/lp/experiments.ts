/**
 * Registry der Landing-Page-Experimente (Split-Tests auf callday.io).
 *
 * Ein Experiment = eine Variable auf der organischen Landing (app/page.tsx),
 * mit zwei oder mehr Varianten. Die Zuweisung passiert server-seitig beim
 * Render (lib/lp/server.ts, cookielos per Visitor-Hash), das Rendering der
 * Varianten lebt direkt in page.tsx (`assignment.variant === "b" ? … : …`).
 * Nach dem Test wird der Gewinner zum Default und der Zweig geloescht.
 *
 * Genau EIN aktives Experiment pro Seite: mehrere gleichzeitig wuerden sich
 * gegenseitig verrauschen und bei 10 EUR Tagesbudget nie zu Ende kommen.
 *
 * Diese Datei ist reine Daten + pure Helfer und darf ueberall importiert
 * werden (Client, Server, Tests). Kein `server-only`.
 *
 * Workflow pro Test: docs/experiments.md.
 */

export type LpMetric = "cta_click" | "signup_started" | "signup_confirmed";

export interface LpVariant {
  /** Kurz und URL-tauglich (`?v=b`), landet in lp_events.variant. */
  key: string;
  /** Was der Besucher sieht — nur fuer Admin und Logbuch. */
  label: string;
  /** Relatives Gewicht; 1/1 = 50:50. */
  weight: number;
}

export interface LpExperiment {
  /** Landet in lp_events.experiment_key. Einmalig ueber alle Tests. */
  key: string;
  name: string;
  /** Ein Satz: was aendert sich, warum sollte es wirken. */
  hypothesis: string;
  /** ISO-Datum (YYYY-MM-DD). Events davor zaehlen nicht zum Test. */
  startedAt: string;
  /** Die Metrik, auf der entschieden wird. */
  primaryMetric: LpMetric;
  /** Erwartete Basisrate der primaryMetric (aus der Baseline-Phase). */
  baselineRate: number;
  /** Gesuchter relativer Effekt, z. B. 0.3 = plus 30 Prozent. */
  relativeMde: number;
  /** Erste Variante = Kontrolle (der bisherige Default). */
  variants: LpVariant[];
}

/**
 * Das laufende Experiment. `null` = kein Test, alle sehen den Default,
 * das Funnel-Tracking laeuft trotzdem (Baseline).
 *
 * Beispiel fuer den ersten Test (Headline-Winkel):
 *
 *   export const ACTIVE_EXPERIMENT: LpExperiment | null = {
 *     key: "hero-headline-01",
 *     name: "Hero-Headline: Prokrastination vs. Ergebnis",
 *     hypothesis:
 *       "Eine Ergebnis-Headline holt Meta-Besucher besser ab als das " +
 *       "Prokrastinations-Framing, weil die Anzeige das Ergebnis verspricht.",
 *     startedAt: "2026-10-01",
 *     primaryMetric: "signup_started",
 *     baselineRate: 0.12,
 *     relativeMde: 0.3,
 *     variants: [
 *       { key: "a", label: "Less avoiding. More dialing.", weight: 1 },
 *       { key: "b", label: "Book more meetings from cold calls.", weight: 1 },
 *     ],
 *   };
 */
export const ACTIVE_EXPERIMENT: LpExperiment | null = null;

export function findVariant(
  experiment: LpExperiment,
  key: string | null | undefined,
): LpVariant | null {
  if (!key) return null;
  return experiment.variants.find((v) => v.key === key) ?? null;
}

/** Kontrolle = erste Variante der Liste. */
export function controlVariant(experiment: LpExperiment): LpVariant {
  return experiment.variants[0];
}
