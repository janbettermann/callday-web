"use client";

import { useEffect, useState, useTransition } from "react";

import type {
  AffiliateRow,
  AffiliateStatus,
} from "@/lib/admin/affiliate-queries";

import {
  changeAffiliateStatusAction,
  resendInviteAction,
  updateAffiliateAction,
} from "../actions";

/**
 * Edit-Sheet das von rechts in den Viewport sliced. Wird via Hash-State
 * gesteuert (`#a-<id>`), damit Linking + Back-Button funktionieren.
 *
 * Inhalt:
 *   - Edit-Form (Name, Email, Founder-Toggle, Notes; Slug ist permanent)
 *   - Status-Actions (Pause / Resume / Remove)
 *   - Resend-Invite-Button (triggert Welcome-Mail erneut)
 *
 * Slug ist bewusst NICHT editierbar — Vertragsklausel "Permanent-Link
 * callday.io/a/{slug}" (Plan-Memory). Wenn Slug-Aenderung wirklich noetig:
 * direkt in Supabase.
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

  // Esc → close
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

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit affiliate ${affiliate.slug}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex-1 bg-[#1a1d26]/30 backdrop-blur-[2px]"
      />

      {/* Sheet */}
      <div className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1a1d26]/[0.06] bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.2px] text-[#1a1d26]/40">
              Affiliate
            </div>
            <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight">
              {affiliate.slug}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#1a1d26]/50 hover:bg-[#1a1d26]/5"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
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

        <div className="space-y-8 px-6 py-6">
          <StatsRow affiliate={affiliate} />

          <SectionHeader label="Status" />
          <div className="flex flex-wrap gap-2">
            <StatusButton
              label="Active"
              active={affiliate.status === "active"}
              disabled={isPending || affiliate.status === "active"}
              onClick={() => handleStatusChange("active")}
              variant="primary"
            />
            <StatusButton
              label="Paused"
              active={affiliate.status === "paused"}
              disabled={isPending || affiliate.status === "paused"}
              onClick={() => handleStatusChange("paused")}
              variant="warn"
            />
            <StatusButton
              label="Removed"
              active={affiliate.status === "removed"}
              disabled={isPending || affiliate.status === "removed"}
              onClick={() => handleStatusChange("removed")}
              variant="danger"
            />
          </div>

          <SectionHeader label="Invite" />
          <div className="rounded-xl border border-[#1a1d26]/[0.06] bg-[#faf9f5] p-4">
            <div className="mb-2 text-sm text-[#1a1d26]/70">
              {affiliate.invited_at
                ? `Last sent ${fmtDateTime(affiliate.invited_at)}`
                : "Not yet invited."}
            </div>
            <button
              type="button"
              onClick={handleResendInvite}
              disabled={isPending || affiliate.status === "removed"}
              aria-busy={isPending}
              className="rounded-lg border border-[#1a1d26]/15 bg-white px-3.5 py-2 text-sm font-medium text-[#1a1d26] transition hover:bg-[#1a1d26]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {affiliate.invited_at ? "Resend invite" : "Send invite"}
            </button>
            {affiliate.status === "removed" ? (
              <p className="mt-2 text-xs text-[#1a1d26]/45">
                Cannot send to removed affiliates. Set Active first.
              </p>
            ) : null}
          </div>

          <SectionHeader label="Details" />
          <form action={handleUpdate} className="space-y-3">
            <Field label="Name">
              <input
                name="name"
                defaultValue={affiliate.name}
                required
                className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                defaultValue={affiliate.email}
                required
                className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1a1d26]/70">
              <input
                type="checkbox"
                name="founder_tier"
                defaultChecked={affiliate.founder_tier}
                className="h-4 w-4 rounded border-[#1a1d26]/30"
              />
              Founding affiliate
            </label>
            <Field label="Notes">
              <textarea
                name="notes"
                rows={3}
                defaultValue={affiliate.notes ?? ""}
                className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
              />
            </Field>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="rounded-lg bg-[#3564e0] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2b56c4] disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? "Saving…" : "Save details"}
            </button>
          </form>
        </div>

        {(actionError || actionInfo) && (
          <div className="sticky bottom-0 border-t border-[#1a1d26]/[0.06] bg-white px-6 py-3">
            {actionError ? (
              <p className="text-sm text-[#dc2626]">{actionError}</p>
            ) : null}
            {actionInfo ? (
              <p className="text-sm text-[#16a34a]">{actionInfo}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsRow({ affiliate }: { affiliate: AffiliateRow }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Sign-ups" value={affiliate.signup_count} />
      <Stat label="Activated" value={affiliate.activated_count} />
      <Stat
        label="CR"
        value={
          affiliate.signup_count === 0
            ? "—"
            : `${Math.round(
                (affiliate.activated_count / affiliate.signup_count) * 100,
              )}%`
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#1a1d26]/[0.06] bg-[#faf9f5] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[1.2px] text-[#1a1d26]/40">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="-mb-2 font-mono text-[10px] uppercase tracking-[1.2px] text-[#1a1d26]/40">
      {label}
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
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#1a1d26]/65">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusButton({
  label,
  active,
  disabled,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "primary" | "warn" | "danger";
}) {
  const activeBg =
    variant === "primary"
      ? "bg-[#16a34a]/10 border-[#16a34a]/40 text-[#15803d]"
      : variant === "warn"
        ? "bg-[#f59e0b]/10 border-[#f59e0b]/40 text-[#a16207]"
        : "bg-[#dc2626]/10 border-[#dc2626]/40 text-[#b91c1c]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? `rounded-lg border px-3.5 py-1.5 text-sm font-medium ${activeBg}`
          : "rounded-lg border border-[#1a1d26]/15 bg-white px-3.5 py-1.5 text-sm font-medium text-[#1a1d26]/70 transition hover:bg-[#1a1d26]/5 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {label}
    </button>
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
