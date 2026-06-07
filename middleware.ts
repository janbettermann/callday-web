/**
 * Next.js Middleware — refreshed Supabase Auth-Cookies bei jedem Request.
 *
 * Per @supabase/ssr-Pattern zwingend nötig für saubere SSR-Auth + um
 * PKCE-Code-Verifier-Cookies über Redirect-Hops konsistent zu halten.
 *
 * matcher exkludiert statische Assets damit die Middleware nicht auf
 * jedem CSS/Image-Request läuft (Cookie-Refresh ist da unnötig + kostet
 * Latenz).
 *
 * Hinweis: Next 16 zeigt für diese File-Convention eine Deprecation-
 * Warning und schlägt `proxy.ts` mit Function-Export `proxy()` vor.
 * Aktuell bleiben wir bewusst auf `middleware.ts` — der Migrations-Weg
 * verlangt Body-internes Path-Matching (kein `config.matcher` mehr) und
 * bringt für uns aktuell keinen Vorteil. Sobald Next die alte Convention
 * wirklich entfernt (Next 17/18), migrieren wir.
 */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match alles AUSSER statische Files + Next-Internals
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
