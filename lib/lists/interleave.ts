/**
 * Round-Robin-Merge mehrerer Streams: erst das erste Element jedes
 * Streams, dann die zweiten, … — leere/kuerzere Streams fallen einfach
 * aus der Runde. Geteilt zwischen der Liefer-Reihenfolge
 * (pipeline.orderForDelivery, Fairness ueber Location-Chips) und der
 * Wellen-Planung (tiles.planWave, Fairness ueber Chips beim Ziehen der
 * Tiles) — beide Stellen brauchen exakt dieselbe Fairness-Regel.
 */
export function interleave<T>(streams: T[][]): T[] {
  const merged: T[] = [];
  for (let i = 0, added = true; added; i++) {
    added = false;
    for (const stream of streams) {
      if (i < stream.length) {
        merged.push(stream[i]);
        added = true;
      }
    }
  }
  return merged;
}
