/**
 * GET /api/lists/download?list=<id> — CSV-Export einer generierten
 * Liste. Kein Gate (bewusste Entscheidung, Spec §5): die Gratis-Liste
 * ist frei herunterladbar, der Wertabgriff ist der Signup.
 *
 * Auth: eingeloggter User; die Liste muss ihm gehoeren (Ownership-Check
 * gegen lead_lists.user_id, sonst 404).
 */

import { NextRequest } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST cappt bei 1000 Rows/Request — Free-Listen (250) passen locker,
 *  bezahlte groessere Listen brauchen spaeter Pagination. */
const EXPORT_MAX_ROWS = 1000;

const CSV_HEADER = [
  "Company",
  "Phone",
  "Email",
  "Website",
  "Contact",
  "Industry",
  "Location",
];

function csvCell(value: string | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const listId = request.nextUrl.searchParams.get("list");
  if (!listId || !UUID_PATTERN.test(listId)) {
    return Response.json({ error: "invalid_list" }, { status: 400 });
  }

  const admin = getServerSupabase();
  const { data: list, error: listError } = await admin
    .from("lead_lists")
    .select("id, name, user_id")
    .eq("id", listId)
    .maybeSingle();
  if (listError) {
    console.error("[lists/download] list fetch failed", listError);
    return Response.json({ error: "download_failed" }, { status: 500 });
  }
  if (!list || list.user_id !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { data: leads, error: leadsError } = await admin
    .from("leads")
    .select(
      "company_name, phone, email, website, contact_name, industry, location",
    )
    .eq("list_id", listId)
    .order("position_in_batch", { ascending: true })
    .limit(EXPORT_MAX_ROWS);
  if (leadsError) {
    console.error("[lists/download] leads fetch failed", leadsError);
    return Response.json({ error: "download_failed" }, { status: 500 });
  }

  const lines = [
    CSV_HEADER.map(csvCell).join(","),
    ...(leads ?? []).map((lead) =>
      [
        lead.company_name,
        lead.phone,
        lead.email,
        lead.website,
        lead.contact_name,
        lead.industry,
        lead.location,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const slug =
    list.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "leads";

  // BOM, damit Excel das UTF-8 (Umlaute in Firmennamen) korrekt oeffnet.
  return new Response("\u{FEFF}" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="callday-${slug}.csv"`,
    },
  });
}
