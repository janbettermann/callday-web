import type { SubscriptionStatus, UserRow, UserStatus } from "@/lib/admin/dashboard-metrics";

import {
  WbDot,
  WbEmpty,
  WbMailLink,
  WbNumeric,
  WbTable,
  WbTd,
  WbTh,
  WbRow,
  type WbTone,
} from "./admin-ui";

function fmtDays(iso: string | null): string {
  if (!iso) return "–";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

/** Neutral gehalten: "Nie gecallt" ist ein Zustand, kein Alarm. */
const STATUS: Record<UserStatus, { label: string; tone: WbTone }> = {
  active: { label: "Aktiv", tone: "green" },
  stalled: { label: "Stockt", tone: "amber" },
  never_called: { label: "Nie gecallt", tone: "gray" },
  new: { label: "Neu", tone: "blue" },
};

const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Aktiv",
  past_due: "Überfällig",
  canceled: "Gekündigt",
  unpaid: "Unbezahlt",
  incomplete: "Unvollständig",
  incomplete_expired: "Abgelaufen",
  paused: "Pausiert",
};

export function UsersTable({ rows, rangeDays }: { rows: UserRow[]; rangeDays: number }) {
  if (rows.length === 0) {
    return <WbEmpty>Noch keine Nutzer.</WbEmpty>;
  }

  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Nutzer</WbTh>
          <WbTh>Status</WbTh>
          <WbTh>Onboarding</WbTh>
          <WbTh align="right">Listen</WbTh>
          <WbTh align="right">Calls</WbTh>
          <WbTh>Abo</WbTh>
          <WbTh>Letzter Call</WbTh>
          <WbTh align="right">Dabei seit</WbTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const status = STATUS[r.status];
          const sub = r.subscription_status;
          return (
            <WbRow key={r.user_id}>
              <WbTd>
                {r.email ? (
                  <WbMailLink email={r.email} subject="Kurze Frage zu Callday" />
                ) : (
                  <span className="is-faint">keine E-Mail</span>
                )}
                {r.name ? <div className="wb-sub">{r.name}</div> : null}
              </WbTd>
              <WbTd nowrap>
                <WbDot tone={status.tone}>{status.label}</WbDot>
              </WbTd>
              <WbTd nowrap faint={!r.onboarding_completed}>
                {r.onboarding_completed ? "fertig" : "offen"}
              </WbTd>
              <WbTd align="right">
                <WbNumeric value={r.lists} />
              </WbTd>
              <WbTd align="right">
                <WbNumeric value={r.calls} bold={r.calls > 0} />
                {r.callsInRange > 0 ? (
                  <div className="wb-sub">
                    {r.callsInRange} in {rangeDays} Tagen
                  </div>
                ) : null}
              </WbTd>
              <WbTd nowrap faint={!sub} style={sub === "active" || sub === "trialing" ? { fontWeight: 500 } : undefined}>
                {sub ? SUBSCRIPTION_LABEL[sub] : "–"}
              </WbTd>
              <WbTd nowrap faint={!r.last_called_at}>
                {fmtDays(r.last_called_at)}
              </WbTd>
              <WbTd align="right" nowrap muted>
                {fmtDays(r.created_at)}
              </WbTd>
            </WbRow>
          );
        })}
      </tbody>
    </WbTable>
  );
}
