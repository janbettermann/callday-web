/**
 * Statistik fuer die Auswertung der Landing-Page-Experimente. Bewusst
 * klein: Zwei-Anteile-z-Test fuer den klassischen p-Wert, dazu die
 * Wahrscheinlichkeit "B schlaegt A" aus einer Normal-Approximation der
 * Beta-Posteriors — beides reicht fuer Besucherzahlen ab ein paar hundert
 * pro Variante. Keine Sequenzial-Tests: Stichprobe vorher festlegen,
 * durchlaufen lassen, dann auswerten (docs/experiments.md).
 */

/** Standard-Normalverteilung, kumulativ. Abramowitz/Stegun 7.1.26, |err| < 1.5e-7. */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Benoetigte Besucher PRO VARIANTE fuer einen zweiseitigen Test.
 * alpha 0.05, Power 0.8 als Default. `relativeMde` ist der relative
 * Effekt (0.3 = plus 30 Prozent auf die Basisrate).
 */
export function requiredSampleSize(
  baselineRate: number,
  relativeMde: number,
  alpha = 0.05,
  power = 0.8,
): number {
  if (baselineRate <= 0 || baselineRate >= 1 || relativeMde <= 0) return Infinity;
  const p1 = baselineRate;
  const p2 = Math.min(0.999, baselineRate * (1 + relativeMde));
  const delta = p2 - p1;
  if (delta <= 0) return Infinity;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const pBar = (p1 + p2) / 2;
  const n =
    Math.pow(
      zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
      2,
    ) / (delta * delta);
  return Math.ceil(n);
}

/** Inverse Normal-CDF (Acklam), fuer die Quantile in requiredSampleSize. */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

export interface ProportionComparison {
  rateA: number;
  rateB: number;
  /** Relativer Unterschied B zu A, z. B. 0.18 = plus 18 Prozent. */
  relativeLift: number | null;
  /** Zweiseitiger p-Wert des Zwei-Anteile-z-Tests; null bei zu wenig Daten. */
  pValue: number | null;
  /** P(B > A) aus den Beta-Posteriors (Normal-Approximation). */
  probabilityBBeatsA: number | null;
}

/**
 * Vergleich zweier Varianten. `successes`/`trials` sind ganze Besucher,
 * keine Events (ein Besucher zaehlt pro Metrik hoechstens einmal).
 */
export function compareProportions(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number,
): ProportionComparison {
  const rateA = trialsA > 0 ? successesA / trialsA : 0;
  const rateB = trialsB > 0 ? successesB / trialsB : 0;
  const relativeLift = rateA > 0 ? rateB / rateA - 1 : null;

  const enough = trialsA >= 20 && trialsB >= 20;
  let pValue: number | null = null;
  if (enough) {
    const pooled = (successesA + successesB) / (trialsA + trialsB);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / trialsA + 1 / trialsB));
    if (se > 0) {
      const z = (rateB - rateA) / se;
      pValue = 2 * (1 - normalCdf(Math.abs(z)));
    } else {
      pValue = 1;
    }
  }

  let probabilityBBeatsA: number | null = null;
  if (enough) {
    // Beta(s+1, n-s+1) je Variante; Mittelwert und Varianz der Posteriors,
    // Differenz als Normalverteilung.
    const meanA = (successesA + 1) / (trialsA + 2);
    const meanB = (successesB + 1) / (trialsB + 2);
    const varA = (meanA * (1 - meanA)) / (trialsA + 3);
    const varB = (meanB * (1 - meanB)) / (trialsB + 3);
    const sd = Math.sqrt(varA + varB);
    probabilityBBeatsA = sd > 0 ? normalCdf((meanB - meanA) / sd) : 0.5;
  }

  return { rateA, rateB, relativeLift, pValue, probabilityBBeatsA };
}
