import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Server-Init (Node-Runtime) — geladen via instrumentation.ts.
 * Errors-only-Setup: kein Tracing, kein Replay — der Zweck ist der
 * Rauchmelder (kaputte Route/Webhook/Job), nicht Performance-Telemetrie.
 * Ohne NEXT_PUBLIC_SENTRY_DSN in den Env-Vars bleibt das SDK stumm.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});
