/**
 * E-Mail-Auswahl des Generators (Spec §13d) — pure Functions.
 *
 * leads_n_contacts liefert eine Zeile pro gefundener Adresse; hier
 * werden die Zeilen eines Betriebs zu Kandidaten eingedampft und
 * hoechstens EIN Prefill bestimmt. Die Regeln sind bewusst streng:
 * eine falsche Adresse im Feld ist eine stille Fehlfunktion (der
 * Nutzer liest sie am Telefon vor), ein leeres Feld ist ehrlich.
 * Datengrundlage der Regeln: 285-Zeilen-Analyse 2026-07-14/15
 * (Fremd-Domains bei Ketten, Square-Platzhalter, ZInfo 52 % invalid).
 */

export type EmailSource =
  | "website"
  | "facebook"
  | "linkedin"
  | "directory"
  | "guessed"
  | "other";

export interface EmailCandidate {
  email: string;
  source: EmailSource;
}

/** Vertrauens-Rang je Quelle — entscheidet bei Dubletten und Ties. */
const SOURCE_RANK: Record<EmailSource, number> = {
  website: 0,
  facebook: 1,
  linkedin: 2,
  directory: 3,
  other: 4,
  guessed: 5,
};

/** B2B-Kontaktboersen/Suchmaschinen — legitime Funde, aber oft stale
 *  (ZInfo im Testlauf 52 % invalid), deshalb hinter Social gereiht. */
const DIRECTORY_SOURCES = new Set([
  "zinfo",
  "appolo",
  "apollo",
  "crunchbase",
  "bbb",
  "contactout",
  "yahoo",
  "duckduckgo",
  "google",
  "bing",
  "yelp",
  "yellowpages",
]);

/** Template-/Platzhalter-Domains (Square liefert `hi@mystore.com` als
 *  scheinbaren Website-Fund) — nie Kandidat, nie Prefill. */
const PLACEHOLDER_DOMAINS = new Set([
  "mystore.com",
  "example.com",
  "example.org",
  "example.net",
  "domain.com",
  "email.com",
  "yourdomain.com",
  "yoursite.com",
  "test.com",
  "sentry.io",
  "wixpress.com",
]);

/** Freemail-Provider — Tier 2 des Prefills (Inhaber-Postfaecher). */
const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "web.de",
  "t-online.de",
  "freenet.de",
  "msn.com",
  "comcast.net",
  "att.net",
  "sbcglobal.net",
  "protonmail.com",
  "proton.me",
  "mail.com",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Outscrapers source-Werte sind wild gemischt (Kuerzel, Namen, volle
 * URLs) — fuer Regeln und spaetere UI-Labels auf ein festes Enum
 * bringen. Beobachtete Werte: fb/f, linkedin/Linkedin, appolo, ZInfo,
 * bbb, contactout, crunchbase, duckduckgo, yahoo, smtp, ai-research,
 * URLs der eigenen Website UND facebook.com-URLs.
 */
export function normalizeEmailSource(raw: string | undefined): EmailSource {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!value) return "other";
  if (value.startsWith("http")) {
    if (value.includes("facebook.com")) return "facebook";
    if (value.includes("linkedin.com")) return "linkedin";
    return "website";
  }
  if (value === "fb" || value === "f" || value === "facebook") {
    return "facebook";
  }
  if (value === "linkedin") return "linkedin";
  if (value === "ai-research") return "guessed";
  if (DIRECTORY_SOURCES.has(value)) return "directory";
  return "other";
}

function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/**
 * Zeilen eines Betriebs → deduplizierte Kandidaten, beste Quelle
 * gewinnt pro Adresse, sortiert nach Quellen-Rang (stabil).
 */
export function collectEmailCandidates(
  rows: Array<{ email?: string; source?: string }>,
): EmailCandidate[] {
  const byEmail = new Map<string, EmailCandidate>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email)) continue;
    if (PLACEHOLDER_DOMAINS.has(emailDomain(email))) continue;
    const source = normalizeEmailSource(row.source);
    const existing = byEmail.get(email);
    if (!existing || SOURCE_RANK[source] < SOURCE_RANK[existing.source]) {
      byEmail.set(email, { email, source });
    }
  }
  return [...byEmail.values()].sort(
    (a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source],
  );
}

/** Host einer (ggf. protokoll-losen) Website-URL, ohne www. */
function websiteHost(website: string | null): string | null {
  const value = website?.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Nur Buchstaben/Ziffern, lowercase — Vergleichsbasis fuer Tier 2. */
function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Prefill-Wahl (hoechstens eine Adresse):
 *   Tier 1 — Adress-Domain == Website-Host (Subdomains der Website
 *            zaehlen mit: shop.foo.com ↔ @foo.com).
 *   Tier 2 — Freemail, deren Localpart konservativ zum Firmennamen
 *            passt (jeanniessalonanddayspa@gmail.com).
 *   sonst  — null. `guessed` ist von beiden Tiers ausgeschlossen,
 *            auch als einziger Kandidat.
 */
export function choosePrefillEmail(
  candidates: EmailCandidate[],
  business: { website: string | null; companyName: string },
): string | null {
  const trusted = candidates.filter((c) => c.source !== "guessed");

  const host = websiteHost(business.website);
  if (host) {
    const domainMatch = trusted.find((c) => {
      const domain = emailDomain(c.email);
      return domain === host || host.endsWith(`.${domain}`);
    });
    if (domainMatch) return domainMatch.email;
  }

  const nameConcat = normalizeToken(business.companyName);
  if (nameConcat.length < 5) return null;
  const freemailMatch = trusted.find((c) => {
    if (!FREEMAIL_DOMAINS.has(emailDomain(c.email))) return false;
    // Ziffern-Suffixe ab (terrabeautyparade2003 → terrabeautyparade).
    const localpart = normalizeToken(
      c.email.slice(0, c.email.lastIndexOf("@")),
    ).replace(/\d+$/, "");
    if (localpart.length < 5) return false;
    return localpart.includes(nameConcat) || nameConcat.includes(localpart);
  });
  return freemailMatch?.email ?? null;
}
