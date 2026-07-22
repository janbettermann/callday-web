import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Browser-Init (instrumentation-client-Konvention, Next 15.3+).
 * Errors-only; Query-Strings werden vor dem Senden gestrippt — sie
 * koennen Nutzereingaben tragen (z. B. Branche/Stadt-Presets auf
 * /lists), und die gehoeren nicht in ein Fehler-Event.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.split("?")[0];
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
