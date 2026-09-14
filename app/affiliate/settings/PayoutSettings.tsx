"use client";

import { useState, useTransition, type ReactNode } from "react";

import type {
  AffiliatePayout,
  PayoutMethod,
  PayoutMethodState,
} from "@/lib/affiliate-payout";
import { WbBadge, type WbTone } from "@/app/components/werkbank";

import { MethodMark } from "../MethodMark";
import {
  savePaypalAction,
  saveWiseAction,
  confirmPayoutReceivedAction,
  setActivePayoutMethodAction,
  type PayoutActionState,
} from "./actions";

/**
 * Payout-Methoden-Einrichtung (PayPal + Wise) mit zweiseitigem Verify-
 * Handshake. Der Eingang der Testueberweisung wird hier bestaetigt, bevor
 * eine Methode auszahlbar wird. Nur eine VERIFIZIERTE Methode kann aktiv
 * sein.
 *
 * Jede Box hat zwei Modi: Display (read-only Zahldaten + "Edit" + Verify-
 * Controls) und Edit (Felder + "Save" / "Cancel", mit Re-Verify-Warnung,
 * falls die Methode schon test_sent/verified war). `unset` startet im Edit.
 */
export function PayoutSettings({ payout }: { payout: AffiliatePayout }) {
  return (
    <div className="wb-stack">
      <PayPalCard payout={payout} />
      <WiseCard payout={payout} />
    </div>
  );
}

/* ============================ PayPal ============================ */

function PayPalCard({ payout }: { payout: AffiliatePayout }) {
  const m = payout.paypal;
  const isActive = payout.activeMethod === "paypal";
  const [editing, setEditing] = useState(m.state === "unset");
  const [email, setEmail] = useState(m.email ?? "");
  const [saveMsg, setSaveMsg] = useState<PayoutActionState>(null);
  const [pending, start] = useTransition();

  const dirty = email.trim() !== (m.email ?? "");
  const canSave = email.trim().length > 0 && dirty;

  function save() {
    setSaveMsg(null);
    const fd = new FormData();
    fd.set("paypal_email", email.trim());
    start(async () => {
      const res = await savePaypalAction(null, fd);
      setSaveMsg(res);
      if (res?.ok) setEditing(false);
    });
  }
  function cancel() {
    setEmail(m.email ?? "");
    setSaveMsg(null);
    setEditing(false);
  }

  return (
    <MethodCard method="paypal" state={m.state} isActive={isActive}>
      {editing ? (
        <>
          <Field label="PayPal email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={pending}
              autoComplete="email"
              className="wb-input"
            />
          </Field>
          <EditFooter
            state={m.state}
            canSave={canSave}
            pending={pending}
            onSave={save}
            onCancel={m.state === "unset" ? null : cancel}
            saveMsg={saveMsg}
          />
        </>
      ) : (
        <>
          <ReadonlyBlock onEdit={() => setEditing(true)}>
            <ReadonlyField label="PayPal email" value={m.email ?? ""} />
          </ReadonlyBlock>
          <VerifyControls method="paypal" state={m.state} isActive={isActive} />
        </>
      )}
    </MethodCard>
  );
}

/* ============================= Wise ============================= */

function WiseCard({ payout }: { payout: AffiliatePayout }) {
  const m = payout.wise;
  const isActive = payout.activeMethod === "wise";
  const [editing, setEditing] = useState(m.state === "unset");
  const [holder, setHolder] = useState(m.accountHolder ?? "");
  const [country, setCountry] = useState(m.country ?? "");
  const [details, setDetails] = useState(m.details ?? "");
  const [saveMsg, setSaveMsg] = useState<PayoutActionState>(null);
  const [pending, start] = useTransition();

  const dirty =
    holder.trim() !== (m.accountHolder ?? "") ||
    country.trim() !== (m.country ?? "") ||
    details.trim() !== (m.details ?? "");
  const canSave =
    holder.trim().length > 0 && country.trim().length > 0 && details.trim().length > 0 && dirty;

  function save() {
    setSaveMsg(null);
    const fd = new FormData();
    fd.set("wise_account_holder", holder.trim());
    fd.set("wise_country", country.trim());
    fd.set("wise_details", details.trim());
    start(async () => {
      const res = await saveWiseAction(null, fd);
      setSaveMsg(res);
      if (res?.ok) setEditing(false);
    });
  }
  function cancel() {
    setHolder(m.accountHolder ?? "");
    setCountry(m.country ?? "");
    setDetails(m.details ?? "");
    setSaveMsg(null);
    setEditing(false);
  }

  return (
    <MethodCard method="wise" state={m.state} isActive={isActive}>
      {editing ? (
        <>
          <div className="wb-field-grid">
            <Field label="Account holder">
              <input
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="Name on the account"
                disabled={pending}
                className="wb-input"
              />
            </Field>
            <Field label="Country">
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
                disabled={pending}
                className="wb-input"
              />
            </Field>
          </div>
          <Field label="Account details" hint="IBAN, or routing + account number, whatever your bank uses.">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="IBAN DE00 0000 0000 0000 0000 00"
              disabled={pending}
              rows={2}
              className="wb-textarea"
              style={{ minHeight: 56 }}
            />
          </Field>
          <EditFooter
            state={m.state}
            canSave={canSave}
            pending={pending}
            onSave={save}
            onCancel={m.state === "unset" ? null : cancel}
            saveMsg={saveMsg}
          />
        </>
      ) : (
        <>
          <ReadonlyBlock onEdit={() => setEditing(true)}>
            <ReadonlyField label="Account holder" value={m.accountHolder ?? ""} />
            <ReadonlyField label="Country" value={m.country ?? ""} />
            <ReadonlyField label="Account details" value={m.details ?? ""} mono />
          </ReadonlyBlock>
          <VerifyControls method="wise" state={m.state} isActive={isActive} />
        </>
      )}
    </MethodCard>
  );
}

/* =========================== Shared =========================== */

/**
 * Verify-Controls (Display-Modus): der Confirm-Button, im `pending` schon
 * sichtbar aber gesperrt, im `test_sent` gruen und klickbar; bzw. "Make
 * this my payout method" bei einer verifizierten, nicht aktiven Methode.
 */
function VerifyControls({
  method,
  state,
  isActive,
}: {
  method: PayoutMethod;
  state: PayoutMethodState;
  isActive: boolean;
}) {
  const [msg, setMsg] = useState<PayoutActionState>(null);
  const [busy, start] = useTransition();

  function confirm() {
    setMsg(null);
    start(async () => setMsg(await confirmPayoutReceivedAction(method)));
  }
  function makeActive() {
    setMsg(null);
    start(async () => setMsg(await setActivePayoutMethodAction(method)));
  }

  const showConfirm = state === "pending" || state === "test_sent";
  const canConfirm = state === "test_sent";
  const showMakeActive = state === "verified" && !isActive;

  return (
    <div className="wb-stack" style={{ gap: 8 }}>
      {showConfirm || showMakeActive ? (
        <div className="wb-inline">
          {showConfirm ? (
            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm || busy}
              className="wb-btn-primary is-small is-green"
            >
              {busy ? "Confirming…" : "Confirm test transfer"}
            </button>
          ) : null}
          {showMakeActive ? (
            <button type="button" onClick={makeActive} disabled={busy} className="wb-btn">
              {busy ? "Switching…" : "Make this my payout method"}
            </button>
          ) : null}
        </div>
      ) : null}

      {state === "pending" ? (
        <p className="wb-note">
          Saved. Once we send a small test transfer to this method, the button unlocks. Confirm it
          and your payout method is verified.
        </p>
      ) : null}
      {state === "test_sent" ? (
        <p className="wb-note">
          We&apos;ve sent a small test transfer. Confirm it once it lands and your payout method is
          verified.
        </p>
      ) : null}
      {state === "verified" && isActive ? (
        <p className="wb-note">Verified. This is your active payout method.</p>
      ) : null}

      {msg?.error ? <p className="wb-msg-error">{msg.error}</p> : null}
    </div>
  );
}

/**
 * Edit-Footer: "Save" / "Cancel". Save ist erst aktiv, wenn sich etwas
 * geaendert hat (verhindert unnoetiges Verify-Reset). Die Warnung erscheint
 * nur, wenn die Methode schon test_sent/verified war.
 */
function EditFooter({
  state,
  canSave,
  pending,
  onSave,
  onCancel,
  saveMsg,
}: {
  state: PayoutMethodState;
  canSave: boolean;
  pending: boolean;
  onSave: () => void;
  onCancel: (() => void) | null;
  saveMsg: PayoutActionState;
}) {
  const willReset = state === "test_sent" || state === "verified";
  return (
    <div className="wb-stack" style={{ gap: 8 }}>
      {willReset ? <p className="wb-msg-warn">New details need a fresh test transfer to verify.</p> : null}
      <div className="wb-inline">
        <button type="button" onClick={onSave} disabled={pending || !canSave} className="wb-btn-primary is-small">
          {pending ? "Saving…" : state === "unset" ? "Save" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={pending} className="wb-btn">
            Cancel
          </button>
        ) : null}
      </div>
      {saveMsg?.error ? <p className="wb-msg-error">{saveMsg.error}</p> : null}
    </div>
  );
}

/**
 * Read-only Anzeige der gespeicherten Zahldaten + "Edit"-Button. Bewusst
 * expliziter Edit-Schritt: schuetzt Zahldaten vor versehentlichem Aendern
 * und gibt den Ort fuer die Re-Verify-Warnung.
 */
function ReadonlyBlock({ onEdit, children }: { onEdit: () => void; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div className="wb-stack" style={{ minWidth: 0, flex: 1, gap: 10 }}>
        {children}
      </div>
      <button type="button" onClick={onEdit} className="wb-btn">
        Edit
      </button>
    </div>
  );
}

function ReadonlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="wb-kv-label">{label}</div>
      {mono ? <div className="wb-code-box">{value}</div> : <div className="wb-kv-value">{value}</div>}
    </div>
  );
}

const STATE_BADGE: Record<PayoutMethodState, { label: string; tone: WbTone }> = {
  unset: { label: "Not set up", tone: "gray" },
  pending: { label: "Test pending", tone: "amber" },
  test_sent: { label: "Confirm transfer", tone: "blue" },
  verified: { label: "Verified", tone: "green" },
};

function MethodCard({
  method,
  state,
  isActive,
  children,
}: {
  method: PayoutMethod;
  state: PayoutMethodState;
  isActive: boolean;
  children: ReactNode;
}) {
  const s = STATE_BADGE[state];
  return (
    <div className="wb-box" style={isActive ? { borderColor: "var(--wb-blue)" } : undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="wb-inline">
          <MethodMark method={method} height={18} />
          {isActive ? <WbBadge tone="blue">Payout method</WbBadge> : null}
        </span>
        <WbBadge tone={s.tone}>{s.label}</WbBadge>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="wb-field">
      <span className="wb-label">{label}</span>
      {children}
      {hint ? <div className="wb-hint">{hint}</div> : null}
    </label>
  );
}
