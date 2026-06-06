import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client mit service_role-Key.
 *
 * **Niemals in Client-Code importieren.** Der service_role-Key bypassed
 * RLS komplett — er gehört ausschließlich in API-Routes und Edge-Functions.
 *
 * Wir bauen das pro Request neu (statt einer Modul-Level-Singleton), damit
 * Next.js' Caching/Edge-Runtime keinen Connection-Pool zwischen Requests
 * sharen kann.
 */
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, serviceRole, {
    auth: {
      // Disable session persistence — API routes are stateless
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
