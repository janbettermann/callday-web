import type { DashboardKpis, KpiValue } from "@/lib/admin/dashboard-metrics";

import { WbDelta, WbMetricStrip } from "./admin-ui";

const nf = new Intl.NumberFormat("de-DE");

function prev(value: KpiValue): string {
  return value.previous === null ? "" : `Vorperiode ${nf.format(value.previous)}`;
}

/**
 * Funnel als Leiste mit fuenf Zellen. Links drei Ereignisse im Zeitraum
 * mit Vorperiode, rechts zwei Momentaufnahmen (profiles kennt keinen
 * Trial-Start-Zeitpunkt), grau abgesetzt.
 */
export function FunnelStrip({ kpis }: { kpis: DashboardKpis }) {
  return (
    <WbMetricStrip
      items={[
        {
          key: "signups",
          label: "Neue Sign-ups",
          value: nf.format(kpis.signups.current),
          delta: <WbDelta current={kpis.signups.current} previous={kpis.signups.previous} />,
          sub: prev(kpis.signups),
        },
        {
          key: "firstList",
          label: "Liste angelegt",
          value: nf.format(kpis.firstList.current),
          delta: <WbDelta current={kpis.firstList.current} previous={kpis.firstList.previous} />,
          sub: `Erste eigene Liste · ${prev(kpis.firstList)}`,
        },
        {
          key: "activated",
          label: "Erster Call",
          value: nf.format(kpis.activated.current),
          delta: <WbDelta current={kpis.activated.current} previous={kpis.activated.previous} />,
          sub: `Erstes Outcome · ${prev(kpis.activated)}`,
        },
        {
          key: "trialing",
          label: "Trial",
          value: nf.format(kpis.trialing),
          sub: "Stand jetzt",
          snapshot: true,
        },
        {
          key: "paying",
          label: "Zahlend",
          value: nf.format(kpis.paying),
          sub: "Stand jetzt",
          snapshot: true,
        },
      ]}
    />
  );
}
