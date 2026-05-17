import type { Metadata } from "next";
import { CalldayLogo } from "../components/CalldayLogo";
import styles from "./share-card.module.css";

/**
 * Server-Component die die Share-Card als reines HTML rendert. Wird vom
 * `/api/share-card`-Route via Puppeteer-Screenshot zu PNG verwandelt und
 * an die Mobile-App ausgeliefert.
 *
 * Page laeuft komplett ohne Nav/Footer (root-Layout enthaelt nur
 * html/body) und ist via `noindex` aus Google rausgenommen. Die URL
 * ist trotzdem im Web erreichbar — hilft beim Dev-Workflow, weil man
 * im Browser sofort sieht was Puppeteer screenshotten wird.
 *
 * Query-Params:
 *   - calls    (number, default 0)
 *   - meetings (number, default 0)
 *   - date     (ISO-String, default heute)
 *
 * Visueller Aufbau matched 1:1 die HTML-Mockup-Vorlage
 * `callday-card-brand.html`: Off-white 9:16 Story-Canvas, 4:5 Polaroid-
 * Card, blauer Brand-Gradient, Amber-Halo + scharfer Sun-Disk in der
 * Ecke, milchige Stats-Box mit echtem backdrop-filter blur.
 */

export const metadata: Metadata = {
  // Bewusst NICHT indexierbar — die Page ist ein Rendering-Target,
  // kein Content fuer Suchmaschinen oder Menschen.
  robots: { index: false, follow: false },
  title: "Callday share card",
};

type SP = Promise<{
  calls?: string;
  meetings?: string;
  date?: string;
}>;

function parseIntSafe(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateUS(iso: string | undefined): string {
  // Default = heute lokal beim Render. Bei Bedarf vom Caller ISO-String
  // mitgegeben (z.B. damit der Capture in einer anderen Zeitzone
  // konsistent ist). Locale fix auf en-US, Format "May 14, 2026".
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ShareCardPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const calls = parseIntSafe(sp.calls, 0);
  const meetings = parseIntSafe(sp.meetings, 0);
  const dateLabel = formatDateUS(sp.date);

  return (
    <div className={styles.story}>
      <div className={styles.card}>
        {/* TOP BAR */}
        <div className={styles.barTop}>
          <div className={styles.brand}>
            <CalldayLogo size={22} />
            <span className={styles.brandName}>Callday</span>
          </div>
          <div className={styles.date}>{dateLabel}</div>
        </div>

        {/* VIBE CANVAS */}
        <div className={styles.canvas}>
          <div className={styles.halo} />
          <div className={styles.sun} />
          <div className={styles.statsOverlay}>
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Calls made</span>
                <span className={styles.statNum}>{calls}</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statLabel}>Meetings booked</span>
                <span className={`${styles.statNum} ${styles.statNumAccent}`}>
                  {meetings}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className={styles.barBottom}>
          <span className={styles.slogan}>
            Cold calling,
            <br />
            zero friction.
          </span>
          <span className={styles.domain}>callday.io</span>
        </div>
      </div>
    </div>
  );
}
