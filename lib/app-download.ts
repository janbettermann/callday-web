/**
 * APP_STORE_LIVE — der Launch-Tag-Schalter fuer den Web-Funnel.
 *
 * Solange false laeuft alles wie in der Beta: Signup-Mail + /account-Karte
 * zeigen auf den TestFlight-Public-Link (Env TESTFLIGHT_PUBLIC_LINK).
 * Am Launch-Tag: Flag auf true flippen + pushen (= Live-Deploy) — damit
 * schalten Signup-Mail (App-Store-Variante statt TestFlight-2-Step) und
 * die /account-Download-Karte gleichzeitig auf den App Store um.
 *
 * WICHTIG vor dem Flip: APP_STORE_URL braucht die echte Apple-ID der App
 * (App Store Connect → App-Informationen → Apple-ID). Die URL funktioniert
 * erst, wenn die App im Store live ist — deshalb nicht frueher flippen.
 */
// Explizit als boolean typisiert, damit der Flip auf true keine
// Narrowing-Folgefehler in den Callern ausloest.
export const APP_STORE_LIVE: boolean = false;

// Apple-ID aus App Store Connect (App-Informationen). Die URL ist ab
// dem Store-Go-Live erreichbar — vorher bleibt APP_STORE_LIVE false.
export const APP_STORE_URL = "https://apps.apple.com/app/id6767268376";

/**
 * Der eine Download-Link fuer alle Web-Oberflaechen (/account-Karte).
 * Null nur im Beta-Modus ohne konfigurierte Env — Caller blenden die
 * Karte dann aus (bestehendes Verhalten).
 */
export function getAppDownloadLink(): string | null {
  if (APP_STORE_LIVE) return APP_STORE_URL;
  return process.env.TESTFLIGHT_PUBLIC_LINK ?? null;
}
