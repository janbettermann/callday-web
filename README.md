# Callday Web

Marketing-Site für [callday.io](https://callday.io) — landing page,
Privacy & Terms — und später Web-Checkout, Affiliate-Dashboard
und Web-App-Routes.

Successor to the archived
[dealswipe-web](https://github.com/janbettermann/dealswipe-web) repo
(pre-rebrand, May 2026).

**Mobile-App-Repo:** [`dealswipe-app`](https://github.com/janbettermann/dealswipe-app)
(Pfad bleibt aus Legacy-Gründen, kein Rename geplant). Cross-Repo-Themen wie
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
│   └── SignupForm.tsx    # Account-Sign-Up (client component, Landing + /a/[slug])
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
- [ ] Phone-Mockup: aktuelles Callday-Screenshot statt Platzhalter einsetzen
      (`public/phone-mockup.png`)
- [ ] OpenGraph-Image (`public/og.png`, 1200×630) erstellen
- [ ] Favicon-Set bauen (16/32/180/512 px) + `manifest.json`
- [ ] Cookie-Banner ergänzen, sobald Tracking eingebaut wird
- [ ] Stripe-Integration für Web-Checkout (Phase 2)
- [ ] Tolt / Rewardful für Affiliate-Programm (Phase 3)
