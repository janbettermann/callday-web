"use client";

/**
 * Global Error Boundary für die Root-App.
 *
 * Wird gerendert wenn ein Error in der Root-Layout-Hierarchie auftritt,
 * der von keinem näheren error.tsx gefangen wird. Muss eigenes
 * <html>/<body> mitbringen, weil der RootLayout in dem Moment nicht
 * verfügbar ist.
 *
 * Standalone-Datei + handgemachtes Markup statt Re-Use vom Root-Layout —
 * Next.js mountet uns mit kaputter App-Tree, deshalb keine Annahmen über
 * verfügbare Components/Context.
 */

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Errors hier loggen — irgendwann an Sentry/etc. weitergeben.
    // Aktuell nur console.error damit's in Vercel-Logs auftaucht.
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#faf9f5",
          color: "#1a1d26",
          margin: 0,
          padding: "80px 24px",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.5px",
              marginBottom: 12,
            }}
          >
            Something broke on our end.
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "rgba(26, 29, 38, 0.62)",
              marginBottom: 24,
            }}
          >
            We&apos;ve been notified. Try again in a moment, or reach out at{" "}
            <a
              href="mailto:hello@callday.io"
              style={{ color: "#3564e0", textDecoration: "underline" }}
            >
              hello@callday.io
            </a>{" "}
            if it keeps happening.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              background: "#4a7af7",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
