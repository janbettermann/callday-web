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
