/**
 * Supabase Client für Client Components ("use client"). Liest die
 * Session aus den Cookies die der SSR-Client gesetzt hat.
 *
 * Nutzt den anon-Key (kein service_role im Browser!).
 *
 * Verwendung in Client Components:
 *   const supabase = createSupabaseBrowser();
 *   const { error } = await supabase.auth.signInWithOtp({ ... });
 */

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
    );
  }

  return createBrowserClient(url, anonKey);
}
