/**
 * GET /api/lists/download?list=<id>[&format=xlsx] — Export einer
 * generierten Liste. Kein Gate (bewusste Entscheidung, Spec §5): die
 * Gratis-Liste ist frei herunterladbar, der Wertabgriff ist der Signup.
 *
 * Zwei Formate: `xlsx` (Default-Button in der UI — formatierte
 * Kopfzeile, Freeze, Auto-Filter; oeffnet locale-unabhaengig korrekt,
 * waehrend Komma-CSV in deutschem Excel in einer Spalte landet) und
 * `csv` als Rohformat fuer CRM-Importe.
 *
 * Auth: eingeloggter User; die Liste muss ihm gehoeren (Ownership-Check
 * gegen lead_lists.user_id, sonst 404).
 */

import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
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

  const rows = (leads ?? []).map((lead) => [
    lead.company_name,
    lead.phone,
    lead.email,
    lead.website,
    lead.contact_name,
    lead.industry,
    lead.location,
  ]);

  const slug =
    list.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "leads";

  if (request.nextUrl.searchParams.get("format") === "xlsx") {
    const buffer = await buildWorkbook(list.name, rows);
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="callday-${slug}.xlsx"`,
      },
    });
  }

  const lines = [
    CSV_HEADER.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];

  // BOM, damit Excel das UTF-8 (Umlaute in Firmennamen) korrekt oeffnet.
  return new Response("\u{FEFF}" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="callday-${slug}.csv"`,
    },
  });
}

const COLUMN_WIDTHS = [34, 20, 26, 42, 20, 22, 40];

/**
 * Formatiertes Workbook: Brand-blaue Kopfzeile (fixiert), Auto-Filter,
 * lesbare Spaltenbreiten. Bewusst schlicht — es soll nach sauberem
 * Werkzeug aussehen, nicht nach Report-Deko.
 */
async function buildWorkbook(
  listName: string,
  rows: Array<Array<string | null>>,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  // Sheet-Name = Listenname (Excel-Limit 31 Zeichen, Sonderzeichen raus).
  const sheetName =
    listName.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31) || "Leads";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = CSV_HEADER.map((header, index) => ({
    header,
    width: COLUMN_WIDTHS[index],
  }));
  for (const row of rows) {
    sheet.addRow(row.map((value) => value ?? ""));
  }

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3564E0" },
  };
  headerRow.alignment = { vertical: "middle" };
  sheet.autoFilter = { from: "A1", to: "G1" };

  // Zur Laufzeit ein Node-Buffer — als BodyInit-kompatibler ArrayBuffer
  // typisiert (exceljs' eigener Buffer-Typ passt nicht auf Response).
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
