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
  const isActive = payout.activeMethod === "paypal";
  const [email, setEmail] = useState(payout.paypal.email ?? "");
  const [msg, setMsg] = useState<PayoutActionState>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    const fd = new FormData();
    fd.set("paypal_email", email.trim());
    start(async () => setMsg(await savePaypalAction(null, fd)));
  }

  return (
    <MethodCard
      method="paypal"
      state={payout.paypal.state}
      isActive={isActive}
    >
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
      <CardFooter
        method="paypal"
        state={payout.paypal.state}
        isActive={isActive}
        dirty={email.trim() !== (payout.paypal.email ?? "")}
        canSave={email.trim().length > 0}
        pending={pending}
        onSave={save}
        msg={msg}
        setMsg={setMsg}
      />
    </MethodCard>
  );
}

/* ============================= Wise ============================= */

function WiseCard({ payout }: { payout: AffiliatePayout }) {
  const isActive = payout.activeMethod === "wise";
  const [holder, setHolder] = useState(payout.wise.accountHolder ?? "");
  const [country, setCountry] = useState(payout.wise.country ?? "");
  const [details, setDetails] = useState(payout.wise.details ?? "");
  const [msg, setMsg] = useState<PayoutActionState>(null);
  const [pending, start] = useTransition();

  const dirty =
    holder.trim() !== (payout.wise.accountHolder ?? "") ||
    country.trim() !== (payout.wise.country ?? "") ||
    details.trim() !== (payout.wise.details ?? "");
  const canSave =
    holder.trim().length > 0 &&
    country.trim().length > 0 &&
    details.trim().length > 0;

  function save() {
    setMsg(null);
    const fd = new FormData();
    fd.set("wise_account_holder", holder.trim());
    fd.set("wise_country", country.trim());
    fd.set("wise_details", details.trim());
    start(async () => setMsg(await saveWiseAction(null, fd)));
  }

  return (
    <MethodCard method="wise" state={payout.wise.state} isActive={isActive}>
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
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 48,
          }}
        />
      </Field>
      <CardFooter
        method="wise"
        state={payout.wise.state}
        isActive={isActive}
        dirty={dirty}
        canSave={canSave}
        pending={pending}
        onSave={save}
        msg={msg}
        setMsg={setMsg}
      />
    </MethodCard>
  );
}

/* =========================== Shared =========================== */

/**
 * Footer einer Methoden-Card: Save-Button (+ ggf. Confirm-received oder
 * Make-active), plus Fehler/Info-Zeile. Confirm/SetActive teilen sich den
 * pending-State ueber eine eigene Transition.
 */
function CardFooter({
  method,
  state,
  isActive,
  dirty,
  canSave,
  pending,
  onSave,
  msg,
  setMsg,
}: {
  method: PayoutMethod;
  state: PayoutMethodState;
  isActive: boolean;
  dirty: boolean;
  canSave: boolean;
  pending: boolean;
  onSave: () => void;
  msg: PayoutActionState;
  setMsg: (m: PayoutActionState) => void;
}) {
  const [actPending, startAct] = useTransition();
  const busy = pending || actPending;

  function confirm() {
    setMsg(null);
    startAct(async () => setMsg(await confirmPayoutReceivedAction(method)));
  }
  function makeActive() {
    setMsg(null);
    startAct(async () => setMsg(await setActivePayoutMethodAction(method)));
  }

  // „Editing" = Details eingeben/ändern → nur dann ist Speichern relevant. Sonst
  // beziehen sich die Verify-Buttons auf die GESPEICHERTE Methode. Der Confirm-
  // Button ist schon im `pending`-State sichtbar (ausgegraut), damit der nächste
  // Schritt klar ist — er schaltet frei, sobald die Testüberweisung raus ist.
  const editing = dirty || state === "unset";
  const canConfirm = state === "test_sent";
  const showConfirm =
    !editing && (state === "pending" || state === "test_sent");
  const showMakeActive = !editing && state === "verified" && !isActive;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {editing ? (
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !canSave}
            style={primaryBtn(busy || !canSave)}
          >
            {pending ? "Saving…" : state === "unset" ? "Save" : "Save changes"}
          </button>
        ) : null}

        {showConfirm ? (
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm || busy}
            style={canConfirm ? confirmBtn(busy) : disabledConfirmBtn}
          >
            {actPending ? "Confirming…" : "Confirm test transfer"}
          </button>
        ) : null}

        {showMakeActive ? (
          <button
            type="button"
            onClick={makeActive}
            disabled={busy}
            style={secondaryBtn(busy)}
          >
            {actPending ? "Switching…" : "Make this my payout method"}
          </button>
        ) : null}
      </div>

      {!editing && state === "pending" ? (
        <p style={hintLine}>
          Saved. Once we send a small test transfer to this method, this button
          unlocks — confirm it and your payout method is verified.
        </p>
      ) : null}
      {!editing && state === "test_sent" ? (
        <p style={hintLine}>
          We&apos;ve sent a small test transfer. Confirm it once it lands and
          your payout method is verified.
        </p>
      ) : null}

      {msg?.error ? (
        <p style={{ ...hintLine, color: "#b91c1c" }}>{msg.error}</p>
      ) : null}
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
                fontFamily: "var(--font-mono), monospace",
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
  fontSize: 15,
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
