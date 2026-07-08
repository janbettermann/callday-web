import Link from "next/link";
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
  fetchTopUsers,
  type InternalView,
} from "@/lib/admin/queries";

import { LoginForm } from "./_components/LoginForm";
import { FunnelCards } from "./_components/FunnelCards";
import { DailyCallersChart } from "./_components/DailyCallersChart";
import { FeedbackTable } from "./_components/FeedbackTable";
import { UserTable } from "./_components/UserTable";
import { InactiveUsersTable } from "./_components/InactiveUsersTable";
import { AdminNav } from "./_components/admin-ui";
import { logoutAction } from "./actions";

// Root-Layout setzt `dynamic = "force-dynamic"` (Next-16-Prerender-Bug-
// Workaround in app/layout.tsx); damit ist jeder Request hier ohnehin
// frisch. Kein extra `revalidate` noetig — bei Single-User-Dashboard
// brennt die Latenz auch nicht.

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; view?: string }>;
};

const VALID_VIEWS: InternalView[] = ["real", "internal", "all"];

function parseView(raw: string | undefined): InternalView {
  if (raw && (VALID_VIEWS as readonly string[]).includes(raw)) {
    return raw as InternalView;
  }
  return "real";
}

const VIEW_LABELS: Record<InternalView, string> = {
  real: "Real users",
  internal: "Internal",
  all: "All",
};

export default async function AdminPage({ params, searchParams }: PageProps) {
  const { secret } = await params;
  const { e: errFlag, view: viewRaw } = await searchParams;

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

  const view = parseView(viewRaw);

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

  const [funnel, callers, feedback, topUsers, inactive] = await Promise.all([
    safe(
      () => fetchFunnel(view),
      {
        applications: 0,
        signups: 0,
        withList: 0,
        withFirstCall: 0,
        activeLast7Days: 0,
      },
      "funnel",
    ),
    safe(() => fetchDailyCallers(view), [], "callers"),
    safe(() => fetchLatestFeedback(view), [], "feedback"),
    safe(() => fetchTopUsers(view), [], "topUsers"),
    safe(() => fetchInactiveUsers(view), [], "inactive"),
  ]);

  const errors = [
    funnel.error && ["funnel", funnel.error],
    callers.error && ["callers", callers.error],
    feedback.error && ["feedback", feedback.error],
    topUsers.error && ["topUsers", topUsers.error],
    inactive.error && ["inactive", inactive.error],
  ].filter(Boolean) as [string, string][];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <header style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <AdminNav current="dashboard" basePath={`/${secret}`} />
            <form action={logoutAction}>
              <button
                type="submit"
                style={{
                  background: "#ffffff",
                  border: "0.5px solid var(--line)",
                  color: "var(--ink-dim)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-1.2px",
              lineHeight: 1.05,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Callday{" "}
            <span className="italic" style={{ color: "var(--blue-deep)" }}>
              internals.
            </span>
          </h1>
        </header>

        <div style={{ marginBottom: 32 }}>
          <ViewTabs current={view} basePath={`/${secret}`} />
        </div>

        {errors.length > 0 ? (
          <div
            style={{
              marginBottom: 32,
              border: "0.5px solid rgba(220,38,38,0.3)",
              background: "rgba(220,38,38,0.04)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "#b91c1c",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Some sections failed to load
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: "var(--ink-dim)",
              }}
            >
              {errors.map(([label, msg]) => (
                <li key={label} style={{ padding: "2px 0" }}>
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {label}
                  </span>
                  : {msg}
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

        <Section title="Latest feedback" subtitle="Click email to reply">
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

        <footer
          style={{
            marginTop: 80,
            paddingTop: 24,
            borderTop: "0.5px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-label)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "var(--ink-faint)",
          }}
        >
          <span>Refresh for latest</span>
          <span>Callday · internal</span>
        </footer>
      </div>
    </div>
  );
}

function ViewTabs({
  current,
  basePath,
}: {
  current: InternalView;
  basePath: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 14,
        padding: 4,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      {VALID_VIEWS.map((v) => {
        const active = v === current;
        const href = v === "real" ? basePath : `${basePath}?view=${v}`;
        return (
          <Link
            key={v}
            href={href}
            style={
              active
                ? {
                    background: "var(--ink)",
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }
                : {
                    color: "var(--ink-dim)",
                    borderRadius: 10,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }
            }
          >
            {VIEW_LABELS[v]}
          </Link>
        );
      })}
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
    <section style={{ marginBottom: 48 }}>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "var(--ink-faint)",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--ink-dim)",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
