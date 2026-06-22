"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  cookieOptions,
  getAdminPath,
  signSession,
} from "@/lib/admin/auth";

/**
 * Server-Action fuer den Login-Form.
 *
 * Bei Match wird ein httpOnly-Cookie gesetzt und auf die Page redirected.
 * Bei Mismatch: 1 Sekunde kuenstliche Latenz (gegen Timing-Probes) und
 * Redirect zurueck mit `?e=1` Hash, damit der Form-State seinen Error
 * rendert.
 *
 * Wir nutzen bewusst KEIN throw — Next-Errors wuerden Stack-Traces in
 * der Response leaken (im Dev) bzw. ungefaerbte 500er ausloesen.
 */
export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const adminPath = getAdminPath();
  const expected = process.env.ADMIN_PASSWORD;

  if (!adminPath || !expected) {
    redirect("/");
  }

  // Timing-safe Vergleich. Beide Strings muessen gleich lang sein damit's
  // wirklich konstant ist; einfache Loesung ist die Limit-Strategie.
  let ok = false;
  if (password.length === expected.length) {
    let diff = 0;
    for (let i = 0; i < password.length; i++) {
      diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    ok = diff === 0;
  }

  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    redirect(`/${adminPath}?e=1`);
  }

  const { value, expiresAt } = await signSession();
  const jar = await cookies();
  jar.set({
    ...cookieOptions(expiresAt),
    value,
  });

  redirect(`/${adminPath}`);
}

export async function logoutAction() {
  const adminPath = getAdminPath();
  const jar = await cookies();
  jar.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  if (adminPath) {
    redirect(`/${adminPath}`);
  }
  redirect("/");
}
