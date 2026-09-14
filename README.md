# Callday Web

Marketing-Site und eingeloggter Web-Bereich für [callday.io](https://callday.io):
Landing, Sign-up, Lead-Listen-Generator, Account-Dashboard, Affiliate-Bereich,
Admin, Privacy & Terms.

**Mobile-App-Repo:** [`callday-app`](https://github.com/janbettermann/callday-app)
(lokal `C:\Dev\callday-app`). Cross-Repo-Themen wie Schema-Änderungen,
Privacy-URL-Updates oder geteilte Marken-Tokens betreffen beide — Schema zuerst
im App-Repo (`supabase/migrations`), dann ggf. ein Read-Endpunkt hier.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Sprache:** TypeScript
- **Styling:** globales `globals.css` (Brand-Tokens als CSS-Variablen), Tailwind v4 nur als Postcss-Basis
- **Content:** MDX für Privacy / Terms / Zoom-Doku (`app/(legal)/`)
- **Daten/Auth:** Supabase (SSR-Cookies via `@supabase/ssr`, Service-Role server-seitig)
- **Mail:** Resend (React-Email-Templates in `emails/`)
- **Hosting:** Vercel — **jeder Push auf `main` ist ein Live-Deploy**
- **Domain-DNS:** Vercel (Registrar Hostinger)
- **Tests:** Vitest (`npm test`), `@/`-Alias über `vitest.config.ts`

## Lokal starten

```bash
npm install
npm run dev
```

→ http://localhost:3000. Eingeloggt testen ohne Passwort-Eingabe:
`http://localhost:3000/api/dev/login` (nur `NODE_ENV=development` +
`DEV_LOGIN_EMAIL` in `.env.local`).

## Struktur

```
app/
├── page.tsx                  # Landing (leitet Eingeloggte auf /dashboard)
├── a/[slug]/                 # Affiliate-Landing (Attribution beim Sign-up)
├── login/, confirm/          # Sign-in, OTP-Bestätigung nach Sign-up
├── auth/callback/            # Supabase OAuth/PKCE-Callback + Post-Signup-Mail
├── auth/confirmed/           # Fallback-Seite für den Bestätigungs-Link der App
├── dashboard/, lists/, calldays/, account/   # eingeloggter Bereich (AppShell + AppNav)
├── lists/new/                # Lead-Listen-Generator (Outscraper, lib/lists/*)
├── affiliate/                # Affiliate-Portal (eigene Cookie-Auth), Werkbank-Design
├── [secret]/                 # Admin (Pfad aus Env, Cookie-Auth) — inkl. /experiments, Werkbank-Design
├── api/                      # lists/*, credits, app-download-mail, lp-event, dev/login
├── (legal)/                  # /privacy, /terms (EN + DE), /zoom, /support
├── werkbank.css              # Design "Werkbank" für Admin + Affiliate-Portal (Präfix wb, Wurzel .wb)
└── components/               # SignupForm, AppNav, GetAppCard, LpSession, werkbank.tsx (WbShell, WbPanel, WbTable, …)
emails/                       # Resend-Templates
lib/                          # supabase-*, app-download(-mail), lists/*, admin/*, affiliate-*, lp/*
specs/                        # lists-generator.md, affiliate-*.md
docs/                         # auth-provider-setup.md, experiments.md, marketing/
```

## Wo weiterlesen

- Produkt-Kontext, Design-Tokens, Plan-Modell: `CLAUDE.md` im App-Repo
- Generator: `specs/lists-generator.md`
- Web-OAuth (Apple/Google, JWT-Renewal alle ~5 Monate): `docs/auth-provider-setup.md`
- Landing-Split-Tests mit Meta Ads (Zuweisung, Events, Admin, Workflow): `docs/experiments.md`
- Werkbank-Design (Admin + Affiliate-Portal): Tokens und Klassen in `app/werkbank.css`, Bausteine in `app/components/werkbank.tsx`; Seiten bauen über `AdminShell` (`app/[secret]/_components/admin-ui.tsx`) bzw. `PortalShell` (`app/affiliate/PortalShell.tsx`)
- Launch-Schalter Store vs. TestFlight: `lib/app-download.ts` (`APP_STORE_LIVE`, seit 2026-09-13 `true`)
