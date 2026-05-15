# Callday Web

Marketing-Site für [callday.app](https://callday.app) — landing page,
Privacy & Terms — und später Web-Checkout, Affiliate-Dashboard
und Web-App-Routes.

**Mobile-App-Repo:** `dealswipe-app` (wird umbenannt). Cross-Repo-Themen wie
Schema-Änderungen, Privacy-URL-Updates oder geteilte Marken-Tokens betreffen
beide.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Sprache:** TypeScript
- **Styling:** Tailwind CSS v4 + globaler `globals.css` für die Marketing-Page
- **Content:** MDX für Privacy / Terms (`app/(legal)/`)
- **Hosting:** Vercel (geplant)
- **Domain-DNS:** Hostinger

## Lokal starten

```bash
npm install
npm run dev
```

→ http://localhost:3000

## Struktur

```
app/
├── page.tsx              # Landing Page (server component)
├── layout.tsx            # Root layout (Fonts, Metadata)
├── globals.css           # Marketing-Site-CSS (sun-glow background, light theme)
├── components/
│   └── BetaApplicationForm.tsx  # Beta-Form (client component)
├── auth/
│   └── confirmed/page.tsx       # Supabase-Email-Confirmation-Landing
└── (legal)/              # Route group → URL ist /privacy bzw. /terms
    ├── layout.tsx
    ├── privacy/page.mdx
    └── terms/page.mdx
mdx-components.tsx        # MDX-Typografie-Overrides für Legal-Seiten
```

## TODOs vor Public-Launch

- [ ] Privacy & Terms: Platzhalter (`[Vor- und Nachname]`, `[Adresse]`, `[DATUM]`,
      `[USt-IdNr.]`, etc.) ersetzen, von einem Anwalt prüfen lassen
- [ ] Beta-Form: echtes Backend anschließen (Supabase `beta_applications`-Tabelle)
- [ ] Phone-Mockup: aktuelles Callday-Screenshot statt Platzhalter einsetzen
      (`public/phone-mockup.png`)
- [ ] OpenGraph-Image (`public/og.png`, 1200×630) erstellen
- [ ] Favicon-Set bauen (16/32/180/512 px) + `manifest.json`
- [ ] Cookie-Banner ergänzen, sobald Tracking eingebaut wird
- [ ] Stripe-Integration für Web-Checkout (Phase 2)
- [ ] Tolt / Rewardful für Affiliate-Programm (Phase 3)
