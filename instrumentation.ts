import * as Sentry from "@sentry/nextjs";

/**
 * Next.js-Instrumentation-Hook — laedt die Sentry-Inits pro Runtime.
 * onRequestError faengt unbehandelte Fehler aus Route-Handlern und
 * Server-Components automatisch ein (Next 15+ Konvention).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
