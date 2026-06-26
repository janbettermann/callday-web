import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import { fetchAffiliates } from "@/lib/admin/affiliate-queries";
import type {
  AffiliateRow,
  AffiliateStatus,
} from "@/lib/admin/affiliate-queries";

import { LoginForm } from "../_components/LoginForm";
import { logoutAction } from "../actions";
import { CreateAffiliateForm } from "./_components/CreateAffiliateForm";
import { AffiliateTable } from "./_components/AffiliateTable";
import {
  StatusFilter,
  type StatusFilterValue,
} from "./_components/StatusFilter";

/**
 * /[secret]/affiliates — Admin-Affiliate-Management.
 *
 * Wiederverwendet Auth + Layout-Konventionen von /[secret]/page.tsx
 * (Cookie-Session, LoginForm-Fallback, Tailwind-Tokens).
 *
 * Sections:
 *   - Create-Form (inline, expanded-by-default)
 *   - Status-Filter-Pills
 *   - Affiliate-Tabelle mit Search + Detail-Drawer
 *
 * Daten: fetchAffiliates() laedt alles in einem Pass mit Sign-up/Activated-
 * Counts. Bei 20-30 Founding-Affiliates ist die volle Tabelle pro Render
 * unproblematisch — Pagination Phase 2.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; status?: string; q?: string }>;
};

const VALID_STATUSES: StatusFilterValue[] = [
  "all",
  "active",
  "paused",
  "removed",
];

function parseStatusFilter(raw: string | undefined): StatusFilterValue {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as StatusFilterValue;
  }
  return "all";
}

export default async function AffiliatesAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { secret } = await params;
  const { e: errFlag, status: statusRaw, q: searchRaw } = await searchParams;

  const adminPath = getAdminPath();
  if (!adminPath || secret !== adminPath) {
    notFound();
  }

  const jar = await cookies();
  const sessionCookie = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const authed = await verifySession(sessionCookie);

  if (!authed) {
    return <LoginForm error={errFlag === "1"} />;
  }

  const statusFilter = parseStatusFilter(statusRaw);
  const search = searchRaw ?? "";
  const basePath = `/${secret}/affiliates`;

  // safe-Wrapper analog zum existierenden Dashboard — Einzelfehler killen
  // nicht die ganze Page, sondern werden als Banner gezeigt.
  let affiliates: AffiliateRow[] = [];
  let loadError: string | null = null;
  try {
    affiliates = await fetchAffiliates();
  } catch (e) {
    console.error("[admin/affiliates]", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  const counts: Record<StatusFilterValue, number> = {
    all: affiliates.length,
    active: affiliates.filter((a) => a.status === "active").length,
    paused: affiliates.filter((a) => a.status === "paused").length,
    removed: affiliates.filter((a) => a.status === "removed").length,
  };

  const filtered =
    statusFilter === "all"
      ? affiliates
      : affiliates.filter((a) => a.status === (statusFilter as AffiliateStatus));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-[#1a1d26]/40">
            <Link href={`/${secret}`} className="hover:text-[#1a1d26]/70">
              ← Dashboard
            </Link>
            {" · "}Affiliates
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Founding affiliates
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[#1a1d26]/[0.12] bg-white px-3 py-1.5 text-sm text-[#1a1d26]/70 transition hover:bg-[#1a1d26]/5"
          >
            Sign out
          </button>
        </form>
      </header>

      {loadError ? (
        <div className="mb-8 rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/[0.04] p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[#dc2626]">
            Failed to load affiliates
          </div>
          <div className="font-mono text-xs text-[#1a1d26]/80">{loadError}</div>
        </div>
      ) : null}

      <section className="mb-10">
        <CreateAffiliateForm />
      </section>

      <StatusFilter
        current={statusFilter}
        counts={counts}
        basePath={basePath}
      />

      <AffiliateTable rows={filtered} search={search} />

      <footer className="mt-16 flex justify-between border-t border-[#1a1d26]/[0.06] pt-6 font-mono text-[11px] uppercase tracking-[1.5px] text-[#1a1d26]/40">
        <span>refresh page for latest</span>
        <span>callday · internal · affiliates</span>
      </footer>
    </div>
  );
}
