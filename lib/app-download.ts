/**
 * APP_STORE_LIVE — der Launch-Tag-Schalter fuer den Web-Funnel.
 *
 * Geflippt am 2026-09-13 (App-Store-Go-Live). Seitdem schicken Signup-Mail
 * (lib/testflight-invite.ts → AppStoreDownload-Template) und die
 * "Get the app"-Karte (GetAppCard) auf den App Store; der TestFlight-Public-Link
 * (Env TESTFLIGHT_PUBLIC_LINK) wird nicht mehr gelesen. Der Beta-Zweig
 * bleibt im Code, damit ein Rueckflip (z.B. Store-Pull) ohne Rebuild
 * geht — bewusst kein Env-Schalter, das Flag soll im Diff sichtbar sein.
 *
 * Auch der Generator-CTA (lib/lists/config.ts → APP_DOWNLOAD_PATH) zeigt
 * seit dem Flip direkt auf APP_STORE_URL.
 */
// Explizit als boolean typisiert, damit der Flip keine Narrowing-
// Folgefehler in den Callern ausloest (der Beta-Zweig bleibt erreichbar).
export const APP_STORE_LIVE: boolean = true;

// Apple-ID aus App Store Connect (App-Informationen). Die URL ist ab
// dem Store-Go-Live erreichbar — vorher bleibt APP_STORE_LIVE false.
export const APP_STORE_URL = "https://apps.apple.com/app/id6767268376";

/**
 * Der eine Download-Link fuer alle Web-Oberflaechen (GetAppCard auf
 * /account und Dashboard). Null nur im Beta-Modus ohne konfigurierte Env —
 * die Karte rendert dann nichts (bestehendes Verhalten).
 */
export function getAppDownloadLink(): string | null {
  if (APP_STORE_LIVE) return APP_STORE_URL;
  return process.env.TESTFLIGHT_PUBLIC_LINK ?? null;
}
