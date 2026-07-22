import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge-Init — greift fuer die Middleware (Supabase-Session-
 * Refresh laeuft auf der Edge-Runtime). Gleiches Errors-only-Profil
 * wie der Server-Init.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});
