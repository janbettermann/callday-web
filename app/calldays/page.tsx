import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { avatarInitial } from "@/lib/dashboard/data";
import { AppNav } from "../components/AppNav";
import { AppFooter } from "../components/AppFooter";

export const metadata: Metadata = {
  title: "Your Calldays · Callday",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /calldays — Vollansicht aller Call-Tage (Ziel des "Calldays"-Nav-Tabs).
 * Platzhalter: die Sticker-Historie kommt spaeter; das Dashboard zeigt
 * die letzten drei bereits live.
 */
export default async function CalldaysPage() {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/calldays");

  const admin = getServerSupabase();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();
  const initial = avatarInitial(
    profileRow?.name as string | null,
    (profileRow?.email as string | null) ?? user.email,
  );

  return (
    <>
      <AppNav active="calldays" initial={initial} />
      <main className="dash-wrap">
        <div className="dash-stub">
          <h1 className="dash-stub-title">Your Calldays</h1>
          <p className="dash-stub-body">
            Every day you pick up the phone becomes a shareable sticker. The
            full history lands here soon — your latest days already show on your
            dashboard.
          </p>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
