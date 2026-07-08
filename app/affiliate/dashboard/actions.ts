"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AFFILIATE_SESSION_COOKIE } from "@/lib/affiliate-auth";
import { getServerSupabase } from "@/lib/supabase-server";

import { requireAffiliateId } from "../require-session";

/**
 * Sign out — clear das Session-Cookie + redirect zu /affiliate/login.
 */
export async function affiliateSignOutAction() {
  const jar = await cookies();
  jar.set({
    name: AFFILIATE_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  redirect("/affiliate/login");
}

export type AddPostState = { error?: string; ok?: boolean } | null;

/**
 * Legt einen vom Affiliate gemeldeten Post an (Link + Zeitpunkt). `posted_at`
 * kommt als UTC-ISO-String vom Client — die datetime-local→UTC-Umrechnung
 * passiert im Browser (AddPostForm), damit die Wall-Clock-Zeit stimmt.
 * Fuer useActionState: (prevState, formData) → newState.
 */
export async function addAffiliatePostAction(
  _prev: AddPostState,
  formData: FormData,
): Promise<AddPostState> {
  const affiliateId = await requireAffiliateId();

  const rawUrl = String(formData.get("url") ?? "").trim();
  const postedAtIso = String(formData.get("posted_at") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || null;
  const type =
    String(formData.get("type") ?? "post").trim() === "story"
      ? "story"
      : "post";

  // Link ist Pflicht bei einem Post, optional bei einer Story (die hat keinen
  // dauerhaften Permalink, verfaellt nach 24h). Leer + Story → url = null; die
  // Stats haengen ohnehin an posted_at, nicht am Link.
  let normalizedUrl: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      normalizedUrl = u.toString();
    } catch {
      return { error: "That doesn't look like a link — include https://" };
    }
  } else if (type === "post") {
    return { error: "Add the post link." };
  }

  if (!postedAtIso) return { error: "Pick when you posted it." };
  const postedAt = new Date(postedAtIso);
  if (Number.isNaN(postedAt.getTime())) {
    return { error: "That date/time isn't valid." };
  }

  const sb = getServerSupabase();
  const { error } = await sb.from("affiliate_posts").insert({
    affiliate_id: affiliateId,
    url: normalizedUrl,
    platform,
    posted_at: postedAt.toISOString(),
    type,
  });
  if (error) return { error: "Couldn't save the post. Try again." };

  revalidatePath("/affiliate/dashboard");
  revalidatePath("/affiliate/posts");
  return { ok: true };
}

/**
 * Loescht einen Post. Der `.eq("affiliate_id", …)`-Guard verhindert, dass ein
 * Affiliate fremde Posts loescht (service_role bypassed RLS, also muss der
 * Scope in der Query stehen).
 */
export async function deleteAffiliatePostAction(formData: FormData) {
  const affiliateId = await requireAffiliateId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = getServerSupabase();
  await sb
    .from("affiliate_posts")
    .delete()
    .eq("id", id)
    .eq("affiliate_id", affiliateId);

  revalidatePath("/affiliate/dashboard");
  revalidatePath("/affiliate/posts");
}
