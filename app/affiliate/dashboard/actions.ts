"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AFFILIATE_SESSION_COOKIE } from "@/lib/affiliate-auth";

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
