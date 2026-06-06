/**
 * Supabase-SSR Auth-Middleware-Helper.
 *
 * Per @supabase/ssr-Docs zwingend nötig für saubere Cookie-basierte
 * Session-Verwaltung in Next.js. Refreshed Tokens bei jedem Request,
 * propagiert geänderte Cookies sowohl an den Request (für nachfolgende
 * Server-Komponenten) als auch an die Response (für den Browser).
 *
 * Hat zusätzlich die wichtige Nebenwirkung, dass PKCE-Code-Verifier-
 * Cookies über Domain-Redirects (z.B. Vercel www → non-www) erhalten
 * bleiben.
 *
 * WICHTIG: zwischen createServerClient und supabase.auth.getUser()
 * darf KEIN Code laufen — sonst können Sessions stillschweigend droppen.
 * Genau aus dem Grund tut updateSession auch nichts weiter als getUser()
 * aufzurufen und das Response-Objekt mit refreshed Cookies zurückzugeben.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Env-Vars fehlen → wir können keine Middleware-Auth machen, aber
    // wir wollen die Route auch nicht hart blocken. Einfach pass-through.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // KEIN Code zwischen createServerClient und getUser() — siehe
  // Doc-Kommentar oben.
  await supabase.auth.getUser();

  return supabaseResponse;
}
