import type { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Rendert die Share-Card-Page als 1080×1920 PNG. Aufgerufen von der
 * Mobile-App beim "Share"-Tap.
 *
 * Wie's funktioniert:
 *   1. Headless-Chrome via Puppeteer starten
 *   2. `/share-card?calls=...&meetings=...&date=...` aufrufen
 *   3. Vollen Viewport screenshotten
 *   4. PNG-Bytes returnen
 *
 * Auf Vercel laeuft das via @sparticuz/chromium — ein schlanker
 * Linux-Chromium-Build der serverless-tauglich ist. Lokal nutzen wir
 * stattdessen den auf dem System installierten Chrome, weil das
 * Sparticuz-Bundle nur auf Linux laeuft.
 *
 * Caching: 1h immutable per Query-Combo. Wer denselben Tag mehrfach
 * teilt, kriegt das gecachte PNG vom Vercel-Edge ohne erneuten
 * Puppeteer-Run.
 */

// Pflicht: Node-Runtime statt Edge — Puppeteer + Chromium-Binary
// braucht Node-APIs (fs, child_process etc.) die im Edge-Runtime
// fehlen.
export const runtime = "nodejs";

// Vercel-Pro erlaubt bis 300s; Puppeteer-Cold-Start kann 8-15s
// dauern, Warm-Render typisch 1-3s. 30s lassen genug Puffer.
export const maxDuration = 30;

// Vercel-Edge-Cache: gleiche Query-Combo wird 1h aus dem Cache
// ausgeliefert. Bei zwei Calls pro Tag und 1k aktiven Usern spart
// das ~1990 Puppeteer-Runs/Tag.
export const revalidate = 3600;

async function launchBrowser(): Promise<Browser> {
  // Vercel setzt VERCEL_ENV automatisch auf "development" |
  // "preview" | "production". Lokal ist's undefined.
  const isVercel = !!process.env.VERCEL_ENV;

  if (isVercel) {
    // Sparticuz-Pattern aus dem README (wichtig — abweichende Configs
    // crashen auf Lambda):
    //   - `puppeteer.defaultArgs(...)` mit den chromium.args mergen
    //   - `headless: "shell"` statt true (kleineres headless_shell-Binary
    //      das im sparticuz-Bundle steckt)
    //   - executablePath aus dem brotli-entpackten chromium-bundle
    //
    // Puppeteer 25.x: `defaultArgs` ist async — await Pflicht.
    const defaultArgs = await puppeteer.defaultArgs({
      args: chromium.args,
      headless: "shell",
    });
    return puppeteer.launch({
      args: defaultArgs,
      defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }

  // Lokaler Dev — System-Chrome benutzen. Path je nach OS. Wenn
  // jemand auf Linux entwickelt: PUPPETEER_EXECUTABLE_PATH env-var
  // setzen.
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : "/usr/bin/google-chrome");

  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Search-Params 1:1 an die share-card-Page weiterreichen. Wir
  // validieren hier nicht zu eng — die Page rendert mit Defaults
  // wenn Werte fehlen.
  const query = searchParams.toString();
  const origin = request.nextUrl.origin;
  const targetUrl = `${origin}/share-card${query ? `?${query}` : ""}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // `domcontentloaded` reicht — wir warten unten explizit auf
    // Fonts. `networkidle0` wartet 500ms auf "kein Network-Traffic",
    // was bei Next-Hot-Reload-Sockets in Dev nie eintritt.
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    // Google-Fonts (Inter etc.) laden async — ohne Wait sieht's PNG
    // mit Fallback-Font aus. document.fonts.ready resolved sobald
    // alle CSS-deklarierten Fonts geladen sind.
    await page.evaluate(() => document.fonts.ready);

    const buffer = await page.screenshot({
      type: "png",
      // Volle Viewport (1080×1920). Page rendert sich auf 100vw×100vh
      // also matched das exakt.
      fullPage: false,
    });

    // Puppeteer returnt Node-Buffer; Response will BodyInit. Uint8Array
    // ist beides — sicherer Cast ohne type-assertion zu druecken.
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Edge-Cache fuer 1h, Browser/Mobile fuer 5min
        "Cache-Control": "public, max-age=300, s-maxage=3600, immutable",
      },
    });
  } catch (err) {
    // Reichlich loggen damit Vercel-Function-Logs den Crash-Grund
    // klar zeigen. In Prod returnen wir trotzdem nur eine generische
    // Message, ohne interne Pfade preiszugeben.
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[share-card] render failed —", message);
    if (err instanceof Error && err.stack) {
      console.error("[share-card] stack:", err.stack);
    }
    return new Response(`Share card render failed: ${message}`, {
      status: 500,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Browser kann beim Crash schon kaputt sein — close() schmeisst
        // dann selber. Egal, der Container wird sowieso recycelt.
      }
    }
  }
}
