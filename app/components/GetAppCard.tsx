import { headers } from "next/headers";
import { getAppDownloadLink } from "@/lib/app-download";
import { parseUserAgent } from "@/lib/user-agent";

/**
 * "Callday for iPhone"-Karte — der In-Product-Zeiger auf die App. Bewusst
 * ein Einzeiler statt der frueheren Onboarding-Karte: mehr als ein Zeiger
 * muss es nicht sein. Ziel des Buttons ist getAppDownloadLink (seit dem
 * App-Store-Launch die Store-Seite, im Beta-Zweig der TestFlight-Link);
 * auf Desktop ergaenzt die Karte den "auf dem iPhone oeffnen"-Hinweis
 * (User-Agent, server-seitig).
 *
 * Einsatzorte: /account (immer) und /dashboard (nur solange der User
 * noch keinen Callday hat — Begruendung dort). Rendert nichts, wenn kein
 * Download-Link konfiguriert ist (Beta-Zweig ohne Env).
 */
export async function GetAppCard() {
  const appLink = getAppDownloadLink();
  if (!appLink) return null;

  const { isIOS } = parseUserAgent((await headers()).get("user-agent"));

  return (
    <section
      className="account-card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 220, flex: 1 }}>
        <h2 className="account-card-title" style={{ marginBottom: 4 }}>
          Callday for iPhone
        </h2>
        <p className="account-hint" style={{ margin: 0 }}>
          Your lists sync to the app — that&apos;s where the calling happens.
          {!isIOS && " Open this page on your iPhone to install."}
        </p>
      </div>
      <a
        href={appLink}
        className="account-btn account-btn-primary"
        style={{ width: "auto", whiteSpace: "nowrap", marginTop: 0 }}
      >
        Get the app
      </a>
    </section>
  );
}
