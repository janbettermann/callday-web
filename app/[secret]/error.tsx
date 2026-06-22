"use client";

import { useEffect } from "react";

/**
 * Lokale Error-Boundary fuer die Admin-Route. Faengt Server-Errors aus
 * der page.tsx ab BEVOR sie auf global-error.tsx hochlaufen — und
 * zeigt Message + Digest im UI, damit Diagnose ohne Vercel-Log-Zugriff
 * machbar ist.
 *
 * Sobald das Dashboard stabil laeuft kann diese Datei entweder
 * weggelassen werden (faellt auf global-error zurueck) oder einen
 * generischen Fehler-Screen wie alle anderen Routes liefern.
 */

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold">Admin route crashed</h1>
      <p className="mb-6 text-sm text-[#1a1d26]/60">
        Lokal gefangen — siehe Details unten.
      </p>

      <div className="mb-4 rounded-lg border border-[#1a1d26]/[0.12] bg-white p-4">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#1a1d26]/50">
          Message
        </div>
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#dc2626]">
          {error.message || "(empty)"}
        </pre>
      </div>

      {error.digest ? (
        <div className="mb-4 rounded-lg border border-[#1a1d26]/[0.12] bg-white p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#1a1d26]/50">
            Digest
          </div>
          <code className="font-mono text-xs">{error.digest}</code>
        </div>
      ) : null}

      {error.stack ? (
        <div className="mb-6 rounded-lg border border-[#1a1d26]/[0.12] bg-white p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#1a1d26]/50">
            Stack
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-[#1a1d26]/80">
            {error.stack}
          </pre>
        </div>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[#3564e0] px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
