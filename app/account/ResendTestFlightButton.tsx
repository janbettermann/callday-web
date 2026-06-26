"use client";

import { useState } from "react";

/**
 * Resend-Button auf /account fuer die TestFlight-Invite-Mail.
 *
 * Recovery-Pfad fuer User die die Mail nicht bekommen / verlegt haben.
 * POST geht an /api/affiliate/post-signup — der Endpoint liest die
 * Ziel-Email aus der SSR-Session (post Audit-Fix #5/#6), Caller muss
 * KEINE Email uebergeben und es gibt kein Account-Age-Gate mehr.
 *
 * Idempotent — Resend-Plan-Limits liegen weit ueber dem was ein
 * einzelner User durch manuelle Clicks erreichen kann.
 */

export function ResendTestFlightButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleResend() {
    if (status === "sending") return;
    setStatus("sending");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/affiliate/post-signup", {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(body.error ?? `Request failed (${response.status})`);
        return;
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === "sending" || status === "sent"}
        className="account-btn account-btn-secondary"
      >
        {status === "sending"
          ? "Sending..."
          : status === "sent"
            ? "Email sent ✓"
            : "Resend TestFlight invite"}
      </button>

      {status === "error" && errorMessage && (
        <p className="beta-submit-error" role="alert" style={{ marginTop: 8 }}>
          {errorMessage}
        </p>
      )}
    </>
  );
}
