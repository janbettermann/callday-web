import type { ReactNode } from "react";

import { WbIcon, WbShell, type WbNavItem } from "@/app/components/werkbank";

import { logoutAction } from "../actions";

/**
 * Admin-Huelle im Werkbank-Design: Navigation der vier Admin-Seiten und
 * das Abmelden-Formular, alles andere kommt aus den geteilten Bausteinen
 * (app/components/werkbank.tsx), die hier durchgereicht werden.
 */

export * from "@/app/components/werkbank";

export type AdminNavKey = "dashboard" | "affiliates" | "lists" | "experiments";

const NAV: Array<{ key: AdminNavKey; label: string; path: string; icon: WbNavItem["icon"] }> = [
  { key: "dashboard", label: "Übersicht", path: "", icon: "grid" },
  { key: "experiments", label: "Experiments", path: "/experiments", icon: "flask" },
  { key: "lists", label: "Lists", path: "/lists", icon: "list" },
  { key: "affiliates", label: "Affiliates", path: "/affiliates", icon: "users" },
];

export function AdminShell({
  current,
  basePath,
  title,
  subtitle,
  actions,
  children,
}: {
  current: AdminNavKey;
  basePath: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <WbShell
      tag="Admin"
      homeHref={basePath}
      navLabel="Admin"
      items={NAV.map((item) => ({
        key: item.key,
        label: item.label,
        href: `${basePath}${item.path}`,
        icon: item.icon,
      }))}
      current={current}
      footer={
        <form action={logoutAction}>
          <button type="submit" className="wb-signout">
            <WbIcon name="logout" />
            <span>Abmelden</span>
          </button>
        </form>
      }
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </WbShell>
  );
}
