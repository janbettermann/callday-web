/**
 * Intern-vs-Extern-Klassifikation fuer Admin-Auswertungen.
 *
 * Blocklist statt Allowlist: Vor dem Launch galt "nur die zwei Beta-
 * Tester sind echt", seit dem App-Store-Launch (2026-09-13) ist jeder
 * neue Account echt, ausser er ist erkennbar von uns. Neue interne
 * Accounts (Review-Logins, Testkonten) hier ergaenzen, kein DB-Change
 * noetig.
 *
 * Bewusst ohne "server-only": reine Funktion, laeuft auch in Tests.
 */

/** Ganze Domains, die nur wir nutzen (App-Review, Zoom-Review, Tester). */
const INTERNAL_DOMAINS = new Set(["callday.io"]);

/** Local-Part-Prefixe: deckt jan.bettermann11, jan.bettermann7 und alle
 *  Plus-Tag-Varianten (jan.bettermann11+123@...) ab. */
const INTERNAL_LOCAL_PREFIXES = ["jan.bettermann"];

/** Einzelne Adressen, die nicht ins Muster passen. */
const INTERNAL_EMAILS = new Set<string>([]);

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return true; // unbekannt = sicherheitshalber intern
  const normalized = email.trim().toLowerCase();
  if (INTERNAL_EMAILS.has(normalized)) return true;
  const at = normalized.lastIndexOf("@");
  if (at < 0) return true;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (INTERNAL_DOMAINS.has(domain)) return true;
  return INTERNAL_LOCAL_PREFIXES.some((prefix) => local.startsWith(prefix));
}
