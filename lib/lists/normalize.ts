/**
 * Geteilte Text-Normalisierung fuer lokale Autocomplete-Suchen
 * (Kategorien + Regionen): diakritik- und ß-tolerant, damit "backerei"
 * "Bäckerei" findet und "wurttemberg" "Württemberg". Beide Seiten
 * (Eingabe + Datenbestand) laufen durch dieselbe Funktion.
 */
export function normalizeTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Ortsnamen-Schluessel fuer den PLZ-Namens-Match (geo_postal_codes.
 * search_names ↔ Chip-Text / State-Fan-out-Staedte). Ueber normalizeTerm
 * hinaus tolerant gegen die Schreibweisen-Differenzen zwischen unserem
 * Geo-Asset und GeoNames (Abgleich 2026-09-12): Klammerzusaetze
 * ("Halle (Saale)" → "halle"), Apostrophe ("Lee's Summit" ↔ "Lees
 * Summit"), "St." ↔ "Saint" (GeoNames schreibt US-Staedte aus). Beide
 * Seiten laufen durch dieselbe Funktion.
 */
export function normalizePlaceName(value: string): string {
  return normalizeTerm(value)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/['’`]/g, "")
    .replace(/\bst\.?\s+/g, "saint ")
    .replace(/\s+/g, " ")
    .trim();
}
