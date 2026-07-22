/**
 * Laender-Datensatz fuer den Country-Picker auf /lists.
 *
 * Bewusst OHNE Google-API: Laender sind eine feste, kleine Liste —
 * lokal gefiltert ist schneller und kostenlos. ISO-3166-1-alpha-2-
 * Codes; die Anzeigenamen kommen zur Laufzeit aus Intl.DisplayNames
 * (englisch, UI-Sprache der Seite), damit hier nicht 240 Strings
 * gepflegt werden.
 *
 * `language` steuert die Ergebnis-Sprache bei Outscraper und Places
 * (Kategorien/Adressen): Override fuer die grossen nicht-englischen
 * Maerkte, Default Englisch.
 */

export interface CountryOption {
  code: string;
  label: string;
}

export interface CountryConfig {
  code: string;
  label: string;
  language: string;
}

/** Kern-Maerkte zuerst im Dropdown (DACH-Akquise + US-first-App). */
const PRIORITY_CODES = ["DE", "AT", "CH", "US"];

/** ISO 3166-1 alpha-2, ohne unbewohnte Territorien. */
const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AR", "AS", "AT", "AU",
  "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ",
  "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BW", "BY", "BZ", "CA",
  "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU",
  "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB",
  "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR",
  "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL",
  "IM", "IN", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG",
  "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
  "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG",
  "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO",
  "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ",
  "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT",
  "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VG",
  "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
];

const LANGUAGE_OVERRIDES: Record<string, string> = {
  DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", UY: "es",
  IT: "it", SM: "it", VA: "it",
  PT: "pt", BR: "pt",
  NL: "nl", PL: "pl", TR: "tr", SE: "sv", NO: "no", DK: "da", FI: "fi",
  CZ: "cs", SK: "sk", HU: "hu", RO: "ro", GR: "el", CY: "el",
  JP: "ja", KR: "ko", CN: "zh", TW: "zh", HK: "zh",
  RU: "ru", UA: "uk", TH: "th", VN: "vi", ID: "id",
};

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

function labelFor(code: string): string {
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

let cachedOptions: CountryOption[] | null = null;

/** Prioritaets-Maerkte zuerst, danach alphabetisch. */
export function listCountryOptions(): CountryOption[] {
  if (!cachedOptions) {
    const priority = PRIORITY_CODES.map((code) => ({
      code,
      label: labelFor(code),
    }));
    const rest = COUNTRY_CODES.filter(
      (code) => !PRIORITY_CODES.includes(code),
    )
      .map((code) => ({ code, label: labelFor(code) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    cachedOptions = [...priority, ...rest];
  }
  return cachedOptions;
}

export function findCountry(code: unknown): CountryConfig | null {
  if (typeof code !== "string") return null;
  const upper = code.toUpperCase();
  if (!COUNTRY_CODES.includes(upper)) return null;
  return {
    code: upper,
    label: labelFor(upper),
    language: LANGUAGE_OVERRIDES[upper] ?? "en",
  };
}

/** Prefix-Treffer vor Substring-Treffern, gecappt fuers Dropdown. */
export function searchCountries(query: string, limit = 8): CountryOption[] {
  const needle = query.trim().toLowerCase();
  const all = listCountryOptions();
  if (!needle) return all.slice(0, limit);

  const startsWith: CountryOption[] = [];
  const contains: CountryOption[] = [];
  for (const option of all) {
    const label = option.label.toLowerCase();
    if (label.startsWith(needle)) {
      startsWith.push(option);
    } else if (label.includes(needle)) {
      contains.push(option);
    }
  }
  return [...startsWith, ...contains].slice(0, limit);
}
