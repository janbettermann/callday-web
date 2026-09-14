"use client";

import { useEffect } from "react";

/**
 * Lokale Error-Boundary fuer die Admin-Route. Faengt Server-Errors aus
 * den Pages ab BEVOR sie auf global-error.tsx hochlaufen, und zeigt
 * Message + Digest im UI, damit Diagnose ohne Vercel-Log-Zugriff
 * machbar ist. Optik: Werkbank (admin.css), liegt im .wb-Layout.
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
    <div className="wb-content" style={{ maxWidth: 760, margin: "0 auto", paddingTop: 48 }}>
      <div>
        <h1 style={{ fontSize: 18 }}>Admin-Seite abgestürzt</h1>
        <p style={{ fontSize: 13, color: "var(--wb-ink-2)", marginTop: 4 }}>
          Lokal gefangen, Details unten.
        </p>
      </div>

      <section className="wb-panel">
        <div className="wb-panel-head">
          <div className="wb-panel-heading">
            <h2 className="wb-panel-title">Meldung</h2>
          </div>
        </div>
        <pre className="wb-panel-body" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--wb-mono)", fontSize: 12, color: "var(--wb-red)" }}>
          {error.message || "(leer)"}
        </pre>
      </section>

      {error.digest ? (
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-heading">
              <h2 className="wb-panel-title">Digest</h2>
            </div>
          </div>
          <div className="wb-panel-body">
            <code>{error.digest}</code>
          </div>
        </section>
      ) : null}

      {error.stack ? (
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-heading">
              <h2 className="wb-panel-title">Stack</h2>
            </div>
          </div>
          <pre className="wb-panel-body" style={{ margin: 0, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--wb-mono)", fontSize: 11, color: "var(--wb-ink-2)" }}>
            {error.stack}
          </pre>
        </section>
      ) : null}

      <div>
        <button type="button" onClick={reset} className="wb-btn-primary is-small">
          Nochmal versuchen
        </button>
      </div>
    </div>
  );
}
