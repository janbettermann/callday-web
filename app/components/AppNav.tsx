import Link from "next/link";
import { CalldayLogo } from "./CalldayLogo";

/**
 * Gemeinsame Nav des eingeloggten Account-Bereichs — die sichtbare
 * Klammer, die /lists, /lists/new und /account als EINEN Bereich mit
 * Unterseiten erscheinen laesst (Jan-Entscheidung 2026-07-14).
 *
 * Tabs bewusst minimal (Lists, Account) — ein Dashboard-Tab kommt
 * erst, wenn es echten Dashboard-Inhalt gibt (Credits, Stats).
 * Ausgeloggte Seiten nutzen weiterhin SiteNav (Landing) bzw.
 * ListsNav (Listen-Landing).
 */
export function AppNav({ active }: { active: "lists" | "account" }) {
  return (
    <nav className="site-nav" data-scrolled="true">
      <div className="container nav-inner">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <CalldayLogo size={32} />
          Callday
        </Link>
        <div className="app-nav-tabs">
          <Link
            href="/lists"
            className={
              "app-nav-tab" + (active === "lists" ? " is-active" : "")
            }
          >
            Lists
          </Link>
          <Link
            href="/account"
            className={
              "app-nav-tab" + (active === "account" ? " is-active" : "")
            }
          >
            Account
          </Link>
        </div>
      </div>
    </nav>
  );
}
