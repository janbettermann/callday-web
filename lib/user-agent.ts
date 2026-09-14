/**
 * Server-side User-Agent-Parsing fuer die "Get the app"-Karte (GetAppCard).
 *
 * Callday gibt es nur fuer iPhone. Auf Desktop/Android ist der Store-
 * Button eine Sackgasse — wir sagen dem User dann explizit, dass er auf
 * dem iPhone weitermachen muss.
 */
export interface UserAgentInfo {
  isIOS: boolean;
}

export function parseUserAgent(ua: string | null | undefined): UserAgentInfo {
  if (!ua) return { isIOS: false };

  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  return { isIOS };
}
