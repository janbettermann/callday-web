import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import {
  fetchDailyCallers,
  fetchFunnel,
  fetchInactiveUsers,
  fetchLatestFeedback,
  fetchOutcomeMix,
  fetchTopUsers,
} from "@/lib/admin/queries";

import { LoginForm } from "./_components/LoginForm";
import { FunnelCards } from "./_components/FunnelCards";
import { DailyCallersChart } from "./_components/DailyCallersChart";
import { OutcomeMixChart } from "./_components/OutcomeMixChart";
import { FeedbackTable } from "./_components/FeedbackTable";
import { UserTable } from "./_components/UserTable";
import { InactiveUsersTable } from "./_components/InactiveUsersTable";
import { logoutAction } from "./actions";

// Root-Layout setzt `dynamic = "force-dynamic"` (Next-16-Prerender-Bug-
// Workaround in app/layout.tsx); damit ist jeder Request hier ohnehin
// frisch. Kein extra `revalidate` noetig — bei Single-User-Dashboard
// brennt die Latenz auch nicht.

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string }>;
};

export default async function AdminPage({ params, searchParams }: PageProps) {
  const { secret } = await params;
  const { e: errFlag } = await searchParams;

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

  // Parallel laden — alle Server-Side, alle service_role. Jeder Fetch
  // bekommt einen safe-Wrapper: Einzelfehler killen nicht die ganze
  // Page, sondern werden geloggt und durch sinnvolle Defaults ersetzt.
  // In Production ist das auch der einzige Diagnose-Pfad (Server-
  // Component-Errors werden sonst auf der Boundary gemasked).
  const formatErr = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      if (typeof obj.message === "string") {
        const code = typeof obj.code === "string" ? ` [${obj.code}]` : "";
        const hint =
          typeof obj.hint === "string" && obj.hint ? ` (${obj.hint})` : "";
        return `${obj.message}${code}${hint}`;
      }
      try {
        return JSON.stringify(e);
      } catch {
        return String(e);
      }
    }
    return String(e);
  };

  const safe = async <T,>(
    fn: () => Promise<T>,
    fallback: T,
    label: string,
  ): Promise<{ data: T; error: string | null }> => {
    try {
      return { data: await fn(), error: null };
    } catch (e) {
      console.error(`[admin/${label}]`, e);
      return { data: fallback, error: formatErr(e) };
    }
  };

  const [funnel, callers, mix, feedback, topUsers, inactive] = await Promise.all([
    safe(
      fetchFunnel,
      {
        applications: 0,
        signups: 0,
        withList: 0,
        withFirstCall: 0,
        activeLast7Days: 0,
      },
      "funnel",
    ),
    safe(fetchDailyCallers, [], "callers"),
    safe(fetchOutcomeMix, [], "mix"),
    safe(fetchLatestFeedback, [], "feedback"),
    safe(fetchTopUsers, [], "topUsers"),
    safe(fetchInactiveUsers, [], "inactive"),
  ]);

  const errors = [
    funnel.error && ["funnel", funnel.error],
    callers.error && ["callers", callers.error],
    mix.error && ["mix", mix.error],
    feedback.error && ["feedback", feedback.error],
    topUsers.error && ["topUsers", topUsers.error],
    inactive.error && ["inactive", inactive.error],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-[#1a1d26]/40">
            Internal · {new Date().toUTCString()}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Callday dashboard
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[#1a1d26]/12 bg-white px-3 py-1.5 text-sm text-[#1a1d26]/70 transition hover:bg-[#1a1d26]/5"
          >
            Sign out
          </button>
        </form>
      </header>

      {errors.length > 0 ? (
        <div className="mb-8 rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/[0.04] p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#dc2626]">
            Some sections failed to load
          </div>
          <ul className="space-y-1 font-mono text-xs text-[#1a1d26]/80">
            {errors.map(([label, msg]) => (
              <li key={label}>
                <span className="font-semibold">{label}</span>: {msg}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="Activation funnel" subtitle="Where users drop off">
        <FunnelCards data={funnel.data} />
      </Section>

      <Section
        title="Daily active callers"
        subtitle="Distinct users with at least one call, last 30 days"
      >
        <DailyCallersChart data={callers.data} />
      </Section>

      <Section
        title="Outcome mix"
        subtitle="Per-day breakdown, last 7 days"
      >
        <OutcomeMixChart data={mix.data} />
      </Section>

      <Section
        title="Latest feedback"
        subtitle="Click email to reply"
      >
        <FeedbackTable rows={feedback.data} />
      </Section>

      <Section title="Top users" subtitle="By call count, last 90 days">
        <UserTable rows={topUsers.data} />
      </Section>

      <Section
        title="Inactive users"
        subtitle="Signed up but quiet — never called or no call in 7+ days"
      >
        <InactiveUsersTable rows={inactive.data} />
      </Section>

      <footer className="mt-16 flex justify-between border-t border-[#1a1d26]/[0.06] pt-6 font-mono text-[11px] uppercase tracking-[1.5px] text-[#1a1d26]/40">
        <span>refresh page for latest</span>
        <span>callday · internal</span>
      </footer>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-[#1a1d26]/55">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
