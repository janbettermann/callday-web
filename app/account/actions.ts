/**
 * Server Actions für /account — Account Delete + Sign-out.
 *
 * Server Actions weil sie service-role-Operationen brauchen (Auth-Delete
 * via Supabase Admin) und der User explizit auf Buttons im Account-UI
 * clickt.
 *
 * Historie: `createPortalSessionAction` (Stripe Customer Portal) wurde
 * beim Account-Entruempeln 2026-07-24 entfernt — Subscriptions laufen
 * ab Launch ausschliesslich ueber Apple-IAP in der App, das Web zeigt
 * nur noch einen read-only Hinweis. Der Stripe-Cancel-Block im
 * Account-Delete bleibt fuer Legacy-Stripe-Customer bestehen.
 */

"use server";

import { redirect } from "next/navigation";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

/**
 * Löscht den User-Account komplett:
 *   1. Cancel jede aktive Stripe-Subscription
 *   2. Löscht den Auth-User via Supabase Admin (service_role)
 *   3. Sign out + Redirect zur Homepage
 *
 * Cascade-Delete der profiles-Row passiert automatisch durch
 * `ON DELETE CASCADE` in der Schema-Definition (siehe Migration 0001).
 *
 * Safety-Gate: User muss die eigene Email re-typen als Bestätigung.
 */
export async function deleteAccountAction(formData: FormData) {
  const confirmEmail = String(formData.get("confirm_email") || "").trim();

  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !confirmEmail ||
    confirmEmail.toLowerCase() !== (user.email ?? "").toLowerCase()
  ) {
    throw new Error("Email confirmation does not match");
  }

  // 1. Stripe-Subs canceln (falls vorhanden)
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "active",
        limit: 10,
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    } catch (err) {
      console.error(
        "[deleteAccountAction] failed to cancel stripe subs",
        err,
      );
      // Trotzdem User-Delete versuchen — Stripe-Subs sind orphaned
      // aber nicht critical (kann später manuell ausgeräumt werden).
    }
  }

  // 2. Auth-User löschen via Admin-Client (service_role)
  const adminClient = getServerSupabase();
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    user.id,
  );
  if (deleteError) {
    console.error(
      "[deleteAccountAction] admin.deleteUser failed",
      deleteError,
    );
    throw new Error("Account deletion failed");
  }

  // 3. Lokale Session terminieren + Redirect
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Logout-Action für den "Sign out"-Button auf /account.
 * Cleart die Supabase-Auth-Cookies + Redirect zur Homepage.
 */
export async function signOutAction() {
  const supabase = await createSupabaseSSR();
  // Nur die Session DIESES Browsers beenden. Der supabase-js-Default ist
  // "global" und entwertet alle Sessions des Users serverseitig — der
  // Web-Logout hat damit die iPhone-App mit ausgeloggt (Auth-Log
  // 2026-07-21: Logout von Vercel-IP, danach "Refresh Token Not Found"
  // der App). "Ueberall abmelden" waere ein eigenes Security-Feature.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
