import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { AppNav } from "../../components/AppNav";
import { GeneratorClient } from "./GeneratorClient";

/**
 * /lists/new — der Listen-Generator als eigene Workspace-Seite.
 *
 * Auth-gated (Server-Redirect zu /login, Website-Preset ueberlebt den
 * Login-Umweg via next-Param). Die Zustandslogik (Form → Building →
 * Ready) lebt im GeneratorClient; diese Huelle liefert nur Gate + Nav.
 */

export const metadata: Metadata = {
  title: "New lead list · Callday Lists",
  description:
    "Pick an industry and a city — we build a call-ready lead list.",
  robots: { index: false, follow: false },
};

export default async function NewListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const params = await searchParams;
    const website = typeof params.website === "string" ? params.website : null;
    const next =
      website === "without" || website === "with"
        ? `/lists/new?website=${website}`
        : "/lists/new";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <>
      <AppNav active="lists" />
      <main className="lists-page">
        <GeneratorClient />
      </main>
    </>
  );
}
