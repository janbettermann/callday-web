"use client";

import { useEffect, useState, useTransition } from "react";

import type { AffiliateRow } from "@/lib/admin/affiliate-queries";
import type { AffiliateStatus } from "@/lib/admin/affiliate-lifecycle";
import { deriveLifecycle } from "@/lib/admin/affiliate-lifecycle";
import type {
  AffiliatePayout,
  PayoutMethod,
  PayoutMethodState,
} from "@/lib/affiliate-payout";

import { MethodMark } from "@/app/affiliate/MethodMark";
import { WbBadge, WbDot, type WbTone } from "../../_components/admin-ui";
import {
  changeAffiliateStatusAction,
  markCommissionsPaidAction,
  markPayoutTestSentAction,
  resendInviteAction,
  updateAffiliateAction,
} from "../actions";
import { LIFECYCLE } from "./lifecycle-ui";

/**
 * Detail-Drawer im Werkbank-Design: Slide-Over von rechts, grauer
 * Hintergrund, weisse Boxen mit 1px-Rand, Status als Segment-Schalter.
 * Slug ist permanent (Vertragsklausel).
 */

interface Props {
  affiliate: AffiliateRow;
  open: boolean;
  onClose: () => void;
}

export function AffiliateDetailDrawer({ affiliate, open, onClose }: Props) {
  if (!open) return null;
  return <DrawerBody affiliate={affiliate} onClose={onClose} />;
}

const STATUS_OPTIONS: Array<{ value: AffiliateStatus; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "paused", label: "Pausiert" },
  { value: "removed", label: "Entfernt" },
];

function DrawerBody({
  affiliate,
  onClose,
}: {
  affiliate: AffiliateRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function clearMessages() {
    setActionError(null);
    setActionInfo(null);
  }

  function handleUpdate(formData: FormData) {
    clearMessages();
    formData.set("id", affiliate.id);
    startTransition(async () => {
      const result = await updateAffiliateAction(formData);
      if (!result.ok) setActionError(result.error);
      else setActionInfo("Gespeichert.");
    });
  }

  function handleStatusChange(next: AffiliateStatus) {
    clearMessages();
    const fd = new FormData();
    fd.set("id", affiliate.id);
    fd.set("status", next);
    startTransition(async () => {
      const result = await changeAffiliateStatusAction(fd);
      if (!result.ok) setActionError(result.error);
      else setActionInfo(`Status auf ${STATUS_OPTIONS.find((s) => s.value === next)?.label ?? next} gesetzt.`);
    });
  }

  function handleResendInvite() {
    clearMessages();
    const fd = new FormData();
    fd.set("id", affiliate.id);
    startTransition(async () => {
      const result = await resendInviteAction(fd);
      if (!result.ok) setActionError(result.error);
      else setActionInfo(`Welcome-Mail an ${affiliate.email} gesendet.`);
    });
  }

  function handleMarkTestSent(method: PayoutMethod) {
    clearMessages();
    const fd = new FormData();
    fd.set("id", affiliate.id);
    fd.set("method", method);
    startTransition(async () => {
      const result = await markPayoutTestSentAction(fd);
      if (!result.ok) setActionError(result.error);
      else setActionInfo(`${method === "paypal" ? "PayPal" : "Wise"}-Testüberweisung als gesendet markiert.`);
    });
  }

  // Geld-Action: alle aktuell auszahlbaren Provisionen als bezahlt buchen +
  // Payout-Beleg anlegen (DB-Funktion mark_commissions_paid, atomar). window
  // .confirm davor, weil irreversibel + echtes Geld. Erfolg zeigt den REAL
  // gebuchten Betrag (result.paidCents, aus der DB), nicht die Seiten-Zahl.
  function handleMarkPaid(formData: FormData) {
    clearMessages();
    if (affiliate.available_cents <= 0) return;
    const confirmed = window.confirm(
      `Auszahlung von ${fmtUsd(affiliate.available_cents)} an ${affiliate.slug} buchen?\n\n` +
        "Das markiert alle aktuell auszahlbaren Provisionen als bezahlt und lässt sich nicht rückgängig machen.",
    );
    if (!confirmed) return;
    formData.set("id", affiliate.id);
    startTransition(async () => {
      const result = await markCommissionsPaidAction(formData);
      if (!result.ok) setActionError(result.error);
      else
        setActionInfo(
          `${fmtUsd(result.paidCents)} gebucht, ${result.count} Provision${result.count === 1 ? "" : "en"} markiert.`,
        );
    });
  }

  const lc = LIFECYCLE[deriveLifecycle(affiliate)];
  const removed = affiliate.status === "removed";

  return (
    <div className="wb-drawer-root" role="dialog" aria-modal="true" aria-label={`Affiliate ${affiliate.slug} bearbeiten`}>
      <button type="button" onClick={onClose} aria-label="Schließen" className="wb-drawer-backdrop" />

      <div className="wb-drawer">
        <header className="wb-drawer-head">
          <div>
            <div style={{ fontSize: 12, color: "var(--wb-ink-2)", fontWeight: 500 }}>Affiliate</div>
            <h2 className="wb-drawer-title" style={{ marginTop: 2 }}>{affiliate.slug}</h2>
            <div style={{ fontSize: 13, color: "var(--wb-ink-2)", margin: "2px 0 8px" }}>{affiliate.name}</div>
            <WbDot tone={lc.tone}>{lc.label}</WbDot>
          </div>
          <button type="button" onClick={onClose} className="wb-icon-btn" aria-label="Schließen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="wb-drawer-body">
          <StatsRow affiliate={affiliate} />

          <div className="wb-group">
            <div className="wb-group-label">Status</div>
            <div className="wb-seg" style={{ alignSelf: "flex-start" }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = affiliate.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`wb-seg-item${active ? " is-active" : ""}`}
                    disabled={isPending || active}
                    onClick={() => handleStatusChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="wb-group">
            <div className="wb-group-label">Einladung</div>
            <div className="wb-box">
              <div style={{ fontSize: 13, color: "var(--wb-ink-2)" }}>
                {affiliate.invited_at
                  ? `Zuletzt gesendet ${fmtDateTime(affiliate.invited_at)}`
                  : "Noch nicht eingeladen."}
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleResendInvite}
                  disabled={isPending || removed}
                  aria-busy={isPending}
                  className={affiliate.invited_at ? "wb-btn" : "wb-btn-primary is-small"}
                >
                  {affiliate.invited_at ? "Einladung erneut senden" : "Einladung senden"}
                </button>
              </div>
              {removed ? (
                <p className="wb-note">Entfernte Affiliates bekommen keine Mail. Erst auf Aktiv setzen.</p>
              ) : null}
            </div>
          </div>

          <div className="wb-group">
            <div className="wb-group-label">Guthaben</div>
            <div className="wb-box">
              <div>
                <div className="wb-mini-label">Auszahlbar</div>
                <div className="wb-big" style={{ color: affiliate.available_cents > 0 ? undefined : "var(--wb-ink-3)" }}>
                  {fmtUsd(affiliate.available_cents)}
                </div>
              </div>

              {affiliate.available_cents > 0 ? (
                <form action={handleMarkPaid} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Field label="Methode (optional)">
                    <select name="method" defaultValue={affiliate.payout.activeMethod ?? ""} className="wb-select">
                      <option value="">–</option>
                      <option value="paypal">PayPal</option>
                      <option value="wise">Wise</option>
                    </select>
                  </Field>
                  <Field label="Transaktions-Referenz (optional)">
                    <input name="external_ref" placeholder="PayPal- oder Wise-Transaktions-ID" className="wb-input" />
                  </Field>
                  <Field label="Notiz (optional)">
                    <input name="note" className="wb-input" />
                  </Field>
                  <div>
                    <button type="submit" disabled={isPending} aria-busy={isPending} className="wb-btn-primary is-small">
                      {isPending ? "Wird gebucht…" : `${fmtUsd(affiliate.available_cents)} als bezahlt buchen`}
                    </button>
                  </div>
                  <p className="wb-note">
                    Erst das Geld über die Methode unten schicken, dann hier buchen. Legt einen
                    Auszahlungsbeleg an, der die bezahlten Provisionen bündelt.
                  </p>
                </form>
              ) : (
                <div style={{ fontSize: 13, color: "var(--wb-ink-2)", lineHeight: 1.5 }}>
                  Noch nichts auszahlbar. Provisionen werden nach der 90-Tage-Sperrfrist fällig.
                </div>
              )}
            </div>
          </div>

          <div className="wb-group">
            <div className="wb-group-label">Auszahlungswege</div>
            <PayoutAdmin payout={affiliate.payout} disabled={isPending} onMarkTestSent={handleMarkTestSent} />
          </div>

          <div className="wb-group">
            <div className="wb-group-label">Details</div>
            <form action={handleUpdate} className="wb-box">
              <Field label="Name">
                <input name="name" defaultValue={affiliate.name} required className="wb-input" />
              </Field>
              <Field label="E-Mail">
                <input name="email" type="email" defaultValue={affiliate.email} required className="wb-input" />
              </Field>
              <label className="wb-check">
                <input type="checkbox" name="founder_tier" defaultChecked={affiliate.founder_tier} />
                Founding-Affiliate
              </label>
              <Field label="Notizen">
                <textarea name="notes" rows={3} defaultValue={affiliate.notes ?? ""} className="wb-textarea" />
              </Field>
              <div>
                <button type="submit" disabled={isPending} aria-busy={isPending} className="wb-btn-primary is-small">
                  {isPending ? "Wird gespeichert…" : "Details speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {actionError || actionInfo ? (
          <div className="wb-drawer-foot">
            {actionError ? <p className="wb-msg-error">{actionError}</p> : null}
            {actionInfo ? <p className="wb-msg-ok">{actionInfo}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatsRow({ affiliate }: { affiliate: AffiliateRow }) {
  const signupRate =
    affiliate.view_count === 0
      ? "–"
      : `${Math.round((affiliate.signup_count / affiliate.view_count) * 100)} %`;
  const activationRate =
    affiliate.signup_count === 0
      ? "–"
      : `${Math.round((affiliate.activated_count / affiliate.signup_count) * 100)} %`;
  return (
    <div className="wb-mini-grid">
      <Stat label="Views" value={affiliate.view_count} />
      <Stat label="Sign-ups" value={affiliate.signup_count} />
      <Stat label="Aktiviert" value={affiliate.activated_count} />
      <Stat label="Sign-up-Rate" value={signupRate} />
      <Stat label="Aktivierung" value={activationRate} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="wb-mini">
      <div className="wb-mini-label">{label}</div>
      <div className="wb-mini-value">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="wb-field">
      <span className="wb-label">{label}</span>
      {children}
    </label>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

/** USD-Cents → "$12.34". Ledger ist USD (siehe specs/affiliate-currency.md);
 *  client-safe (kein Server-Import). */
function fmtUsd(cents: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Admin-Sicht der Payout-Methoden. Zeigt die vom Affiliate eingegebenen
 * Zahldaten (damit Jan die Testueberweisung schicken kann) + den Verify-State.
 * Bei state='pending' der Button "Testüberweisung gesendet"; die andere
 * Seite des Handshakes (Affiliate bestaetigt Eingang) lebt in den Settings.
 */
function PayoutAdmin({
  payout,
  disabled,
  onMarkTestSent,
}: {
  payout: AffiliatePayout;
  disabled: boolean;
  onMarkTestSent: (method: PayoutMethod) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PayoutMethodRow
        method="paypal"
        state={payout.paypal.state}
        active={payout.activeMethod === "paypal"}
        details={payout.paypal.email ? [payout.paypal.email] : []}
        disabled={disabled}
        onMarkTestSent={onMarkTestSent}
      />
      <PayoutMethodRow
        method="wise"
        state={payout.wise.state}
        active={payout.activeMethod === "wise"}
        details={
          [payout.wise.accountHolder, payout.wise.country, payout.wise.details].filter(Boolean) as string[]
        }
        disabled={disabled}
        onMarkTestSent={onMarkTestSent}
      />
    </div>
  );
}

const PAYOUT_STATE: Record<PayoutMethodState, { label: string; tone: WbTone }> = {
  unset: { label: "Nicht eingerichtet", tone: "gray" },
  pending: { label: "Test ausstehend", tone: "amber" },
  test_sent: { label: "Wartet auf Bestätigung", tone: "blue" },
  verified: { label: "Verifiziert", tone: "green" },
};

function PayoutMethodRow({
  method,
  state,
  active,
  details,
  disabled,
  onMarkTestSent,
}: {
  method: PayoutMethod;
  state: PayoutMethodState;
  active: boolean;
  details: string[];
  disabled: boolean;
  onMarkTestSent: (method: PayoutMethod) => void;
}) {
  const s = PAYOUT_STATE[state];
  return (
    <div className="wb-box">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MethodMark method={method} height={16} />
          {active ? <WbBadge tone="blue">Aktiv</WbBadge> : null}
        </div>
        <WbBadge tone={s.tone}>{s.label}</WbBadge>
      </div>

      {details.length > 0 ? (
        <div className="wb-code-box">{details.join("\n")}</div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--wb-ink-3)" }}>Noch nicht eingerichtet.</div>
      )}

      {state === "pending" ? (
        <div>
          <button type="button" onClick={() => onMarkTestSent(method)} disabled={disabled} className="wb-btn-primary is-small">
            Testüberweisung gesendet
          </button>
        </div>
      ) : null}
      {state === "test_sent" ? (
        <div style={{ fontSize: 12, color: "var(--wb-ink-2)" }}>
          Test gesendet, wartet auf Bestätigung durch den Affiliate.
        </div>
      ) : null}
    </div>
  );
}
