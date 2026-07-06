/**
 * Server-side User-Agent-Parsing fuer die Account-Welcome-Card.
 *
 * TestFlight laeuft nur auf iPhone/iPad. Auf Desktop/Android sind die
 * Install-Buttons eine Sackgasse — wir sagen dem User dann explizit, dass
 * er auf dem iPhone weitermachen muss.
 */
export interface UserAgentInfo {
  isIOS: boolean;
}

export function parseUserAgent(ua: string | null | undefined): UserAgentInfo {
  if (!ua) return { isIOS: false };

  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  return { isIOS };
}
