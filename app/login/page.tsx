"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CalldayLogo } from "../components/CalldayLogo";
import { LoginForm } from "../components/LoginForm";
import { SiteFooter } from "../components/SiteFooter";

/**
 * /login: Vollseiten-Sign-In. Das Formular selbst lebt in
 * app/components/LoginForm.tsx und wird auch vom Auth-Popup der Landings
 * genutzt (Nav-Link "Log in", siehe SignupModal).
 *
 * ?embed=1 schaltet auf die chromelose In-App-Browser-Variante: keine
 * site-nav, kein Footer, keine bg-orbs, nur das App-Icon mit warmem Glow.
 * Gesetzt wird ?embed=1 nur von der App beim Oeffnen von
 * callday.io/lists/new (und ueberlebt den /lists/new → /login-Redirect).
 */

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

/** Liest die Query-Params; useSearchParams braucht die Suspense-Grenze oben. */
function LoginPageInner() {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  // Ohne explizites next landet der eingeloggte User auf dem Dashboard
  // (Startseite des Account-Bereichs seit 2026-07-15).
  const next = searchParams.get("next") || "/dashboard";
  const presetEmail = searchParams.get("email") || "";
  const rawError = searchParams.get("error");
  const initialError = rawError ? decodeURIComponent(rawError) : null;

  if (embed) {
    return (
      <main className="login-embed">
        <LoginForm embed next={next} presetEmail={presetEmail} initialError={initialError} />
      </main>
    );
  }

  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

      <main className="confirm-page">
        <LoginForm next={next} presetEmail={presetEmail} initialError={initialError} />
      </main>

      <SiteFooter />
    </>
  );
}
