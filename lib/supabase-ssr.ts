/**
 * Supabase Client für Server Components, Server Actions und Route
 * Handlers — Auth-Session lebt in HTTP-Only-Cookies, der Client liest
 * + schreibt sie via @supabase/ssr-Adapter.
 *
 * Verwendung:
 *   const supabase = await createSupabaseSSR();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 * Wichtig: dieser Client nutzt den anon-Key + RLS-Policies, NICHT
 * service_role. Für Privileged-Operationen siehe lib/supabase-server.ts.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseSSR() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // In Server Components (read-only context) wirft .set().
          // Das ist erwartet — Middleware/Route-Handler refreshen die
          // Cookies stattdessen.
        }
      },
    },
  });
}
