import type { ReactNode } from "react";

import { WbIcon, WbShell, type WbNavItem } from "@/app/components/werkbank";

import { affiliateSignOutAction } from "./dashboard/actions";

/**
 * Huelle des Affiliate-Portals: Seitenleiste mit den fuenf Bereichen und
 * dem Abmelden, Kopfzeile mit Seitentitel. Agreement liegt bewusst nicht
 * in der Navigation, sondern unter Settings (Account).
 */

export type PortalNavKey = "dashboard" | "posts" | "activity" | "payouts" | "settings";

const NAV: Array<WbNavItem & { key: PortalNavKey }> = [
  { key: "dashboard", label: "Dashboard", href: "/affiliate/dashboard", icon: "grid" },
  { key: "posts", label: "Posts", href: "/affiliate/posts", icon: "post" },
  { key: "activity", label: "Activity", href: "/affiliate/activity", icon: "activity" },
  { key: "payouts", label: "Payouts", href: "/affiliate/payouts", icon: "wallet" },
  { key: "settings", label: "Settings", href: "/affiliate/settings", icon: "settings" },
];

export function PortalShell({
  current,
  title,
  subtitle,
  actions,
  children,
}: {
  current: PortalNavKey;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <WbShell
      tag="Affiliate"
      homeHref="/affiliate/dashboard"
      navLabel="Affiliate"
      items={NAV}
      current={current}
      footer={
        <form action={affiliateSignOutAction}>
          <button type="submit" className="wb-signout">
            <WbIcon name="logout" />
            <span>Sign out</span>
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
