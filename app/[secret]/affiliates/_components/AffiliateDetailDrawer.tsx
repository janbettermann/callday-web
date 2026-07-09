"use client";

import { useEffect, useState, useTransition } from "react";

import type { AffiliateRow } from "@/lib/admin/affiliate-queries";
import type {
  AffiliateLifecycle,
  AffiliateStatus,
} from "@/lib/admin/affiliate-lifecycle";
import { deriveLifecycle } from "@/lib/admin/affiliate-lifecycle";
import type {
  AffiliatePayout,
  PayoutMethod,
  PayoutMethodState,
} from "@/lib/affiliate-payout";

import { MethodMark } from "@/app/affiliate/MethodMark";
import {
  changeAffiliateStatusAction,
  markCommissionsPaidAction,
  markPayoutTestSentAction,
  resendInviteAction,
  updateAffiliateAction,
} from "../actions";

/**
 * Detail-Drawer, on-brand. Slide-in von rechts, weisser Panel mit
 * cream-tinted Sections, brand-blue Primary-Buttons, Sun-Tint fuer
 * "Founding"-Toggle. Slug ist permanent (Vertragsklausel).
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
      else setActionInfo("Saved.");
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
      else setActionInfo(`Status changed to ${next}.`);
    });
  }

  function handleResendInvite() {
    clearMessages();
    const fd = new FormData();
    fd.set("id", affiliate.id);
    startTransition(async () => {
      const result = await resendInviteAction(fd);
      if (!result.ok) setActionError(result.error);
      else setActionInfo(`Welcome mail sent to ${affiliate.email}.`);
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
      else
        setActionInfo(
          `Marked ${method === "paypal" ? "PayPal" : "Wise"} test transfer as sent.`,
        );
    });
  }

  // Geld-Action: alle aktuell auszahlbaren Provisionen als bezahlt buchen +
  // Payout-Beleg anlegen (DB-Funktion mark_commissions_paid, atomar). window
  // .confirm davor, weil irreversibel + echtes Geld. Erfolg zeigt den REAL
  // gebuchten Betrag (result.paidCents, aus der DB) — nicht die Seiten-Zahl.
  function handleMarkPaid(formData: FormData) {
    clearMessages();
    if (affiliate.available_cents <= 0) return;
    const confirmed = window.confirm(
      `Record a payout of ${fmtUsd(affiliate.available_cents)} to ${affiliate.slug}?\n\n` +
        "This marks all currently available commissions as paid and can't be undone.",
    );
    if (!confirmed) return;
    formData.set("id", affiliate.id);
    startTransition(async () => {
      const result = await markCommissionsPaidAction(formData);
      if (!result.ok) setActionError(result.error);
      else
        setActionInfo(
          `Paid ${fmtUsd(result.paidCents)} — ${result.count} commission${
            result.count === 1 ? "" : "s"
          } marked.`,
        );
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit affiliate ${affiliate.slug}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          flex: 1,
          background: "rgba(26,29,38,0.30)",
          backdropFilter: "blur(2px)",
          border: "none",
          cursor: "pointer",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg)",
          overflowY: "auto",
          boxShadow: "-16px 0 48px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            background: "var(--bg)",
            borderBottom: "0.5px solid var(--line)",
            padding: "20px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                color: "var(--ink-faint)",
              }}
            >
              Affiliate
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "var(--font-mono), monospace",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.4px",
                color: "var(--ink)",
              }}
            >
              {affiliate.slug}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 13,
                color: "var(--ink-dim)",
                marginBottom: 8,
              }}
            >
              {affiliate.name}
            </div>
            <LifecyclePill lifecycle={deriveLifecycle(affiliate)} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              color: "var(--ink-faint)",
            }}
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </header>

        <div
          style={{
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
            flex: 1,
          }}
        >
          <StatsRow affiliate={affiliate} />

          <Section label="Status">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <StatusButton
                label="Active"
                active={affiliate.status === "active"}
                disabled={isPending || affiliate.status === "active"}
                onClick={() => handleStatusChange("active")}
                color="#10b981"
              />
              <StatusButton
                label="Paused"
                active={affiliate.status === "paused"}
                disabled={isPending || affiliate.status === "paused"}
                onClick={() => handleStatusChange("paused")}
                color="#f59e0b"
              />
              <StatusButton
                label="Removed"
                active={affiliate.status === "removed"}
                disabled={isPending || affiliate.status === "removed"}
                onClick={() => handleStatusChange("removed")}
                color="#94a3b8"
              />
            </div>
          </Section>

          <Section label="Invite">
            <div
              style={{
                background: "#ffffff",
                border: "0.5px solid var(--line)",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink-dim)",
                  marginBottom: 12,
                }}
              >
                {affiliate.invited_at
                  ? `Last sent ${fmtDateTime(affiliate.invited_at)}`
                  : "Not yet invited."}
              </div>
              <button
                type="button"
                onClick={handleResendInvite}
                disabled={isPending || affiliate.status === "removed"}
                aria-busy={isPending}
                style={{
                  background: affiliate.invited_at
                    ? "#ffffff"
                    : "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
                  color: affiliate.invited_at ? "var(--ink)" : "#ffffff",
                  border: affiliate.invited_at
                    ? "1px solid var(--line)"
                    : "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor:
                    isPending || affiliate.status === "removed"
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    isPending || affiliate.status === "removed" ? 0.5 : 1,
                  boxShadow: affiliate.invited_at
                    ? "none"
                    : "0 6px 18px rgba(37,99,232,0.22)",
                }}
              >
                {affiliate.invited_at ? "Resend invite" : "Send invite"}
              </button>
              {affiliate.status === "removed" ? (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "var(--ink-faint)",
                  }}
                >
                  Cannot send to removed affiliates. Set Active first.
                </p>
              ) : null}
            </div>
          </Section>

          <Section label="Balance">
            <div
              style={{
                background: "#ffffff",
                border: "0.5px solid var(--line)",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    color: "var(--ink-faint)",
                  }}
                >
                  Available to pay out
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.6px",
                    fontVariantNumeric: "tabular-nums",
                    color:
                      affiliate.available_cents > 0
                        ? "var(--ink)"
                        : "var(--ink-faint)",
                  }}
                >
                  {fmtUsd(affiliate.available_cents)}
                </div>
              </div>

              {affiliate.available_cents > 0 ? (
                <form
                  action={handleMarkPaid}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <Field label="Method (optional)">
                    <select
                      name="method"
                      defaultValue={affiliate.payout.activeMethod ?? ""}
                      style={{
                        width: "100%",
                        background: "rgba(26,29,38,0.045)",
                        border: "1px solid transparent",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 16,
                        color: "var(--ink)",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">—</option>
                      <option value="paypal">PayPal</option>
                      <option value="wise">Wise</option>
                    </select>
                  </Field>
                  <Field label="Transaction ref (optional)">
                    <DrawerInput
                      name="external_ref"
                      placeholder="PayPal / Wise transaction id"
                    />
                  </Field>
                  <Field label="Note (optional)">
                    <DrawerInput name="note" />
                  </Field>
                  <button
                    type="submit"
                    disabled={isPending}
                    aria-busy={isPending}
                    style={{
                      alignSelf: "flex-start",
                      background:
                        "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 18px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isPending ? "wait" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                      boxShadow: "0 6px 18px rgba(37,99,232,0.22)",
                    }}
                  >
                    {isPending
                      ? "Recording…"
                      : `Mark ${fmtUsd(affiliate.available_cents)} paid`}
                  </button>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--ink-faint)",
                      lineHeight: 1.5,
                    }}
                  >
                    Send the real money via the method below first, then log it
                    here. Records a payout receipt grouping the paid commissions.
                  </p>
                </form>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--ink-dim)",
                    lineHeight: 1.5,
                  }}
                >
                  Nothing available yet. Commissions become payable after the
                  90-day hold.
                </div>
              )}
            </div>
          </Section>

          <Section label="Payouts">
            <PayoutAdmin
              payout={affiliate.payout}
              disabled={isPending}
              onMarkTestSent={handleMarkTestSent}
            />
          </Section>

          <Section label="Details">
            <form
              action={handleUpdate}
              style={{
                background: "#ffffff",
                border: "0.5px solid var(--line)",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <Field label="Name">
                <DrawerInput name="name" defaultValue={affiliate.name} required />
              </Field>
              <Field label="Email">
                <DrawerInput
                  name="email"
                  type="email"
                  defaultValue={affiliate.email}
                  required
                />
              </Field>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  color: "var(--ink-dim)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  name="founder_tier"
                  defaultChecked={affiliate.founder_tier}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "var(--blue-deep)",
                  }}
                />
                Founding affiliate
              </label>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={affiliate.notes ?? ""}
                  style={{
                    width: "100%",
                    background: "rgba(26,29,38,0.045)",
                    border: "1px solid transparent",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 16,
                    color: "var(--ink)",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </Field>
              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                style={{
                  alignSelf: "flex-start",
                  background:
                    "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isPending ? "wait" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                  boxShadow: "0 6px 18px rgba(37,99,232,0.22)",
                }}
              >
                {isPending ? "Saving…" : "Save details"}
              </button>
            </form>
          </Section>
        </div>

        {(actionError || actionInfo) && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "var(--bg)",
              borderTop: "0.5px solid var(--line)",
              padding: "14px 28px",
            }}
          >
            {actionError ? (
              <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
                {actionError}
              </p>
            ) : null}
            {actionInfo ? (
              <p style={{ margin: 0, fontSize: 14, color: "#15803d" }}>
                {actionInfo}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsRow({ affiliate }: { affiliate: AffiliateRow }) {
  const signupRate =
    affiliate.view_count === 0
      ? "—"
      : `${Math.round(
          (affiliate.signup_count / affiliate.view_count) * 100,
        )}%`;
  const activationRate =
    affiliate.signup_count === 0
      ? "—"
      : `${Math.round(
          (affiliate.activated_count / affiliate.signup_count) * 100,
        )}%`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 10,
      }}
    >
      <Stat label="Views" value={affiliate.view_count} />
      <Stat label="Sign-ups" value={affiliate.signup_count} />
      <Stat label="Activated" value={affiliate.activated_count} />
      <Stat label="Sign-up rate" value={signupRate} />
      <Stat label="Activation" value={activationRate} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 20,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
          letterSpacing: "-0.3px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--ink-faint)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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
    </label>
  );
}

function DrawerInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: "rgba(26,29,38,0.045)",
        border: "1px solid transparent",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 16,
        color: "var(--ink)",
        outline: "none",
        fontFamily: "inherit",
        ...(props.style ?? {}),
      }}
    />
  );
}

function StatusButton({
  label,
  active,
  disabled,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={
        active
          ? {
              background: `${color}1F`,
              border: `1px solid ${color}66`,
              color: color,
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "default",
            }
          : {
              background: "#ffffff",
              border: "1px solid var(--line)",
              color: "var(--ink-dim)",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }
      }
    >
      {label}
    </button>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: AffiliateLifecycle }) {
  const styles: Record<
    AffiliateLifecycle,
    { background: string; color: string; label: string }
  > = {
    created: {
      background: "rgba(26, 29, 38, 0.06)",
      color: "var(--ink-dim)",
      label: "Created",
    },
    invited: {
      background: "rgba(74, 122, 247, 0.12)",
      color: "var(--blue-deep)",
      label: "Invited",
    },
    active_logged_in: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#047857",
      label: "Active",
    },
    paused: {
      background: "rgba(245, 158, 11, 0.15)",
      color: "#a16207",
      label: "Paused",
    },
    removed: {
      background: "rgba(26, 29, 38, 0.07)",
      color: "var(--ink-faint)",
      label: "Removed",
    },
  };
  const s = styles[lifecycle];
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          background: "currentColor",
        }}
      />
      {s.label}
    </span>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
 * Bei state='pending' der „Mark test transfer sent"-Button — die andere
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          [
            payout.wise.accountHolder,
            payout.wise.country,
            payout.wise.details,
          ].filter(Boolean) as string[]
        }
        disabled={disabled}
        onMarkTestSent={onMarkTestSent}
      />
    </div>
  );
}

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
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MethodMark method={method} height={16} />
          {active ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                color: "var(--blue-deep)",
                background: "rgba(37,99,232,0.1)",
                borderRadius: 100,
                padding: "3px 7px",
              }}
            >
              Active
            </span>
          ) : null}
        </div>
        <PayoutStatePill state={state} />
      </div>

      {details.length > 0 ? (
        <div
          style={{
            background: "rgba(26,29,38,0.045)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--ink)",
            fontFamily: "var(--font-mono), monospace",
            lineHeight: 1.5,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            userSelect: "all",
          }}
        >
          {details.join("\n")}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Not set up yet.
        </div>
      )}

      {state === "pending" ? (
        <button
          type="button"
          onClick={() => onMarkTestSent(method)}
          disabled={disabled}
          style={{
            alignSelf: "flex-start",
            background:
              "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled ? "wait" : "pointer",
            opacity: disabled ? 0.6 : 1,
            boxShadow: "0 4px 12px rgba(37,99,232,0.2)",
          }}
        >
          Mark test transfer sent
        </button>
      ) : null}
      {state === "test_sent" ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>
          Test sent — waiting for the affiliate to confirm it arrived.
        </div>
      ) : null}
    </div>
  );
}

function PayoutStatePill({ state }: { state: PayoutMethodState }) {
  const map: Record<
    PayoutMethodState,
    { label: string; bg: string; fg: string }
  > = {
    unset: { label: "Not set up", bg: "rgba(26,29,38,0.06)", fg: "var(--ink-dim)" },
    pending: { label: "Test pending", bg: "rgba(245,158,11,0.14)", fg: "#a16207" },
    test_sent: {
      label: "Awaiting confirm",
      bg: "rgba(37,99,232,0.12)",
      fg: "var(--blue-deep)",
    },
    verified: { label: "Verified", bg: "rgba(16,185,129,0.14)", fg: "#047857" },
  };
  const s = map[state];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: s.fg,
        background: s.bg,
        borderRadius: 100,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
