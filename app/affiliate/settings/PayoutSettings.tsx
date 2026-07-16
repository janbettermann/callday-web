"use client";

import { useState, useTransition, type ReactNode } from "react";

import type {
  AffiliatePayout,
  PayoutMethod,
  PayoutMethodState,
} from "@/lib/affiliate-payout";

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
 * Handshake. Selbst der Eingang der Testueberweisung wird bestaetigt, bevor
 * eine Methode auszahlbar wird. Nur eine VERIFIZIERTE Methode kann aktiv sein.
 *
 * Jede Karte hat zwei Modi:
 *  - Display: read-only Zahldaten + „Edit" + Verify-Controls (Confirm / Make active)
 *  - Edit:    Felder + „Save changes" / „Cancel" (+ Re-Verify-Warnung, falls die
 *             Methode schon test_sent/verified war — neue Daten brauchen einen
 *             frischen Test). `unset` startet direkt im Edit-Modus.
 */
export function PayoutSettings({ payout }: { payout: AffiliatePayout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PayPalCard payout={payout} />
      <WiseCard payout={payout} />
      <p
        style={{
          margin: "2px 0 0",
          fontSize: 12,
          color: "var(--ink-faint)",
          lineHeight: 1.5,
        }}
      >
        We send a small test transfer to a new method and you confirm it here
        before any real payout goes out — so a typo never sends money to the
        wrong place.
      </p>
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
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={pending}
              autoComplete="email"
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
    holder.trim().length > 0 &&
    country.trim().length > 0 &&
    details.trim().length > 0 &&
    dirty;

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
          <Field label="Account holder">
            <Input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Name on the account"
              disabled={pending}
            />
          </Field>
          <Field label="Country">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="United States"
              disabled={pending}
            />
          </Field>
          <Field
            label="Account details"
            hint="IBAN, or routing + account number — whatever your bank uses."
          >
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="IBAN DE00 0000 0000 0000 0000 00"
              disabled={pending}
              rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: 48 }}
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
 * Verify-Controls (Display-Modus): der Confirm-Button — im `pending` schon
 * sichtbar aber ausgegraut, im `test_sent` grün + klickbar — bzw. „Make this my
 * payout method" bei einer verifizierten, nicht aktiven Methode. Self-contained:
 * eigene Transition + eigene Fehler-Zeile.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {showConfirm || showMakeActive ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {showConfirm ? (
            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm || busy}
              style={canConfirm ? confirmBtn(busy) : disabledConfirmBtn}
            >
              {busy ? "Confirming…" : "Confirm test transfer"}
            </button>
          ) : null}
          {showMakeActive ? (
            <button
              type="button"
              onClick={makeActive}
              disabled={busy}
              style={secondaryBtn(busy)}
            >
              {busy ? "Switching…" : "Make this my payout method"}
            </button>
          ) : null}
        </div>
      ) : null}

      {state === "pending" ? (
        <p style={hintLine}>
          Saved. Once we send a small test transfer to this method, this button
          unlocks — confirm it and your payout method is verified.
        </p>
      ) : null}
      {state === "test_sent" ? (
        <p style={hintLine}>
          We&apos;ve sent a small test transfer. Confirm it once it lands and
          your payout method is verified.
        </p>
      ) : null}
      {state === "verified" && isActive ? (
        <p style={hintLine}>Verified. This is your active payout method.</p>
      ) : null}

      {msg?.error ? (
        <p style={{ ...hintLine, color: "#b91c1c" }}>{msg.error}</p>
      ) : null}
    </div>
  );
}

/**
 * Edit-Footer: „Save changes" / „Cancel". `Save` ist erst aktiv, wenn sich was
 * geändert hat (verhindert unnötiges Verify-Reset). Die Warnung erscheint nur,
 * wenn die gespeicherte Methode schon test_sent/verified war — dann kostet das
 * Ändern die Verifizierung.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {willReset ? (
        <p style={{ ...hintLine, color: "#a16207" }}>
          New details need a fresh test transfer to verify.
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !canSave}
          style={primaryBtn(pending || !canSave)}
        >
          {pending
            ? "Saving…"
            : state === "unset"
              ? "Save"
              : "Save changes"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={secondaryBtn(pending)}
          >
            Cancel
          </button>
        ) : null}
      </div>
      {saveMsg?.error ? (
        <p style={{ ...hintLine, color: "#b91c1c" }}>{saveMsg.error}</p>
      ) : null}
    </div>
  );
}

/**
 * Read-only Anzeige der gespeicherten Zahldaten + „Edit"-Button. Bewusst
 * expliziter Edit-Schritt (statt immer-live Feld): schützt Zahldaten vor
 * versehentlichem Ändern und gibt den natürlichen Ort für die Re-Verify-Warnung.
 */
function ReadonlyBlock({
  onEdit,
  children,
}: {
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
      <button type="button" onClick={onEdit} style={editBtn}>
        Edit
      </button>
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-dim)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: mono ? 13 : 15,
          color: "var(--ink)",
          wordBreak: "break-word",
          ...(mono
            ? {
                fontFamily: "var(--font-mono), monospace",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }
            : {}),
        }}
      >
        {value}
      </div>
    </div>
  );
}

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
  return (
    <div
      style={{
        background: "#ffffff",
        border: isActive
          ? "0.5px solid rgba(37,99,232,0.4)"
          : "0.5px solid var(--line)",
        borderRadius: 20,
        padding: 22,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MethodMark method={method} height={18} />
          {isActive ? (
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                color: "var(--blue-deep)",
                background: "rgba(37,99,232,0.1)",
                border: "0.5px solid rgba(37,99,232,0.22)",
                borderRadius: 100,
                padding: "3px 8px",
              }}
            >
              Payout method
            </span>
          ) : null}
        </div>
        <StateBadge state={state} />
      </div>
      {children}
    </div>
  );
}

function StateBadge({ state }: { state: PayoutMethodState }) {
  const map: Record<
    PayoutMethodState,
    { label: string; bg: string; fg: string }
  > = {
    unset: {
      label: "Not set up",
      bg: "rgba(26,29,38,0.06)",
      fg: "var(--ink-dim)",
    },
    pending: {
      label: "Test pending",
      bg: "rgba(245,158,11,0.14)",
      fg: "#a16207",
    },
    test_sent: {
      label: "Confirm transfer",
      bg: "rgba(37,99,232,0.12)",
      fg: "var(--blue-deep)",
    },
    verified: {
      label: "Verified",
      bg: "rgba(16,185,129,0.14)",
      fg: "#047857",
    },
  };
  const s = map[state];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        color: s.fg,
        background: s.bg,
        borderRadius: 100,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-dim)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
      {hint ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--ink-faint)",
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      ) : null}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(26,29,38,0.045)",
  border: "1px solid transparent",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 16,
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

const hintLine: React.CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--ink-dim)",
};

const editBtn: React.CSSProperties = {
  flexShrink: 0,
  background: "#ffffff",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled ? "none" : "0 6px 18px rgba(37,99,232,0.22)",
  };
}

// Ausgegrauter Confirm-Button im `pending`-State: sichtbar, aber gesperrt bis
// die Testüberweisung raus ist. Kommuniziert den nächsten Schritt visuell.
const disabledConfirmBtn: React.CSSProperties = {
  background: "rgba(26,29,38,0.05)",
  color: "var(--ink-faint)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "not-allowed",
};

function confirmBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "#047857",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "#ffffff",
    color: "var(--ink)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
