# Callday Beta-Application + Founder-Code-Workflow

Implementierungs-Plan für den vollständigen Lifecycle von Beta-Application
bis Founder-Code-Redemption beim Launch.

**Status:** Plan — noch nicht umgesetzt.
**Repo-Aufteilung:** Implementation in `callday-web`. Schema-Migration laut
CLAUDE.md-Regel zuerst in `dealswipe-app/supabase/migrations/`.

---

## Architektur-Übersicht

```
┌─────────────────┐    Form submit     ┌──────────────────┐
│  callday.io     │ ─────────────────► │ /api/beta/apply  │
│  Beta-Form      │                    │ (Next.js Route)  │
└─────────────────┘                    └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │  Supabase        │
                                       │  applications +  │
                                       │  email_logs      │
                                       └────────┬─────────┘
                                                │
                                                │ INSERT inline
                                                │ UPDATE via Webhook
                                                ▼
                                       ┌──────────────────┐
                                       │  Resend          │
                                       │  (4 Templates)   │
                                       └──────────────────┘

Launch-Day:
  /scripts/launch-send-codes.ts
       │
       ├─► Stripe: Promotion-Codes generieren (zu "Founder 50% off"-Coupon)
       ├─► Supabase: founder_code in applications speichern
       └─► Resend: Launch-Email mit Code an alle approved/launch_list/active_beta

User klickt Code-Link in Email:
  callday.io/checkout?code=CALLDAY-XXXXXX
       │
       ▼
  Stripe Checkout (Code pre-applied)
       │
       ▼
  Stripe Webhook → /api/stripe/webhook
       │
       ▼
  Supabase: users.subscription_status = active
       │
       ▼
  App (nächster Login): liest Status, schaltet frei
```

---

## Stack-Entscheidungen

- **Email-Liste:** Supabase als Source of Truth, Resend nur Versand
- **Payment-Provider:** **Stripe** auf Web (callday.io) parallel zu Apple IAP in der App
  - Warum: Apple IAP unterstützt keine self-generierten Discount-Codes; Web-Sub via Stripe ist Pflicht für Founder-Codes + Affiliate-Marketing
  - Apple IAP läuft parallel für User die direkt aus der App heraus signen (ohne Code)
- **Email-Templates:** React Email (`@react-email/components`) — typ-sicher, Live-Preview, brand-konform
- **Trigger-Architektur:** Hybrid
  - INSERT (Confirmation-Email) inline in `/api/beta/apply`
  - UPDATE auf `approved`/`launch_list` via Supabase Database Webhook → eigene API-Routes
  - Rationale: Inline für Form-Submit (ein Roundtrip, sofort testbar), Webhook nur für Status-Changes die du manuell in Supabase Studio machst

---

## Konsistenz-Werte (verbindlich)

| Wert            | Korrekt                  | Falsch (im Original-Plan) |
|-----------------|--------------------------|---------------------------|
| Pricing Monthly | €24,99                   | $24                       |
| Pricing Yearly  | €199                     | $199 (Zahl OK, Währung)   |
| Brand-Blau      | `#2563E8`                | `#4a7af7`                 |
| Marketing-Domain| callday.io               | callday.app               |
| Sender (Beta)   | hello@callday.io         | hello@callday.app         |

---

## Datenmodell

### Migration in `dealswipe-app/supabase/migrations/`

Datei-Name nach Repo-Convention. Schema:

```sql
-- applications: Beta-Bewerbungen + Launch-Liste + Active-Beta-User
CREATE TABLE applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  website               TEXT,
  cold_calls_per_week   TEXT NOT NULL,
  what_they_sell        TEXT,
  current_tool          TEXT NOT NULL,
  has_ios17             BOOLEAN NOT NULL DEFAULT false,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'launch_list',
                                          'active_beta', 'declined')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  testflight_invited_at TIMESTAMPTZ,
  founder_code          TEXT UNIQUE,
  stripe_promotion_id   TEXT,
  code_redeemed_at      TIMESTAMPTZ
);

CREATE INDEX applications_status_idx ON applications(status);
CREATE INDEX applications_created_at_idx ON applications(created_at DESC);

-- email_logs: für Idempotenz + Debug + Resend-Status-Sync
CREATE TABLE email_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID REFERENCES applications(id) ON DELETE CASCADE,
  email_type            TEXT NOT NULL
                        CHECK (email_type IN ('confirmation', 'testflight_invite',
                                              'launch_list_welcome', 'founder_code',
                                              'reminder', 'custom')),
  resend_email_id       TEXT,
  sent_at               TIMESTAMPTZ DEFAULT NOW(),
  status                TEXT DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'opened', 'failed')),
  error_message         TEXT
);

CREATE INDEX email_logs_application_id_idx ON email_logs(application_id);
CREATE INDEX email_logs_type_application_idx ON email_logs(email_type, application_id);

-- RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs   ENABLE ROW LEVEL SECURITY;

-- anonymous role: nur INSERT auf applications (für Form-Submit)
CREATE POLICY anon_insert_applications ON applications
  FOR INSERT TO anon WITH CHECK (true);

-- service_role: vollen Zugriff auf beide Tables (Backend-Operations)
-- (Default: service_role bypassed RLS, keine explizite Policy nötig)
```

**Felder, die aus dem Original-Plan rausgeflogen sind:**
- `source` — kein klarer Use-Case, kann später hinzu wenn UTM-Tracking gebraucht
- `verified_at` — kein klarer Use-Case (Email-Verification ist optional für Beta-Application und würde nur Reibung erzeugen)

**Neu dazugekommen:**
- `stripe_promotion_id` — wir speichern die Stripe-Side ID des generierten Promotion-Codes, sodass wir Code → Stripe-Eintrag wieder finden falls wir den Coupon-Discount ändern
- `error_message` in `email_logs` — beim Fail-Logging hilfreich für Debug

**`has_ios17` bleibt drin** als Self-Selection-Field. Der Disqualifier-Check passiert bereits **im Anmeldeformular auf callday.io** (Frontend-Validation lehnt `false` direkt ab mit freundlicher Meldung "Currently iOS 17+ only, please check back later"). Damit landet kein inkompatibler User-Eintrag in der DB. Das Feld bleibt in der Tabelle als Audit-Spur falls man das Formular später ändert.

**`current_tool` als ENUM-mit-Other-Fallback:**
- Form-Dropdown: `excel`, `salesforce`, `hubspot`, `pipedrive`, `paper`, `other`
- Wenn `other` gewählt: zusätzliches Text-Field
- DB-Feld bleibt TEXT, speichert entweder ENUM-Wert oder freitext

---

## Email-Templates

Alle Templates in `callday-web/emails/`:

- `application-confirmation.tsx`
- `testflight-invite.tsx`
- `launch-list-welcome.tsx`
- `founder-code-at-launch.tsx`

**Brand-Vorgaben für alle Templates:**
- Font: System / Inter Fallback
- Primary: `#2563E8` (Brand-Blau)
- Logo: Callday-Logo aus `callday-web/public/`
- Responsive, Dark-Mode-tolerant
- Footer: Adresse + Reply-To-Hinweis (transactional, kein Unsubscribe-Link zwingend)
- Sender: `hello@callday.io`
- Reply-To: `hello@callday.io`

### Template 1: ApplicationConfirmation
- **Trigger:** INSERT in applications
- **Subject:** "Got your Callday beta application 🎯"
- **Framing-Prinzip:** Erste Mail nimmt NICHTS vorweg — Jan hat noch nichts
  reviewt. Kein "beta is full"-Fiction, keine Vorab-Outcome-Promise. Stattdessen
  neutral + konkreter Founder-Benefit der IMMER gilt.
- **Inhalt:**
  - Persönliche Anrede `{firstName}`
  - "Got your application — thanks for putting your time on the line."
  - "We'll review it and get back to you within 48 hours with next steps."
  - "Either way, your founder spot is locked in: a personal code at launch,
    50% off Callday for life, plus your first month free."
  - Signoff: "Talk soon, Jan"

### Template 2: TestFlightInvite
- **Trigger:** UPDATE applications SET status = 'approved'
- **Subject:** "You're in. Welcome to the Callday beta."
- **Inhalt:**
  - "You're confirmed as one of the 50 beta testers."
  - "Apple will send you a separate TestFlight invite email — that's the
    one with the install link. If you don't see it within a few minutes,
    check spam and confirm your Apple ID matches the email you applied with."
  - Onboarding-Hinweise + erste-Schritte-Anleitung
  - "Beta is free for the full period. Founder pricing (€24,99/mo or €199/yr
    with 50% off + 1 month free) locked in for life when we launch publicly."
  - "I'll DM you in about a week to ask how it's going. If anything breaks,
    just reply to this email."

### Template 3: LaunchListWelcome
- **Trigger:** UPDATE applications SET status = 'launch_list'
- **Subject:** "You're on the Callday launch list"
- **Framing-Prinzip (2026-06-06):** NICHT "beta is full, sorry" — das ist
  heuchlerisch wenn Jan parallel weiter Ads schaltet. Stattdessen ehrliche
  Selektions-Logik: Beta-Kapazität ist auf aktive Daily-Cold-Caller gecappt
  fuer maximale Feedback-Qualitaet. Launch-List ist KEIN "no", sondern eine
  bewusste Match-Entscheidung mit eigenen Vorteilen. Self-Selection-Mechanik
  ergaenzt: wer wirklich aktiv cold-callt, kann mit Beweis (Website / Call-Log /
  CRM-Screenshot) Re-Review anfordern.
- **Inhalt:**
  - Quick-Update: matched zur Launch-List statt closed-beta — als positive
    framen, nicht als "no"
  - **Warum die Trennung sachlich existiert:** Beta ist auf 50 Active-Tester
    gecappt — Auswahl nach "wer gibt das schaerfste Real-World-Feedback".
    Alle anderen kriegen Day-Zero-Access mit Founder-Pricing locked in.
  - **Was sie konkret kriegen:**
    - Personal founder code: 50% off Callday for life
    - First month free
    - Day-zero access — kein waitlist, kein gate
  - **Re-Review-Offer:** "Wenn du aktiv cold-callst und einen zweiten Blick
    auf die Beta willst, antworte auf diese Mail mit etwas das das beweist —
    Link zur Business-Website, ein recent Call-Log, CRM-Screenshot. Wir
    re-reviewen Applications woechentlich. Either way, dein Founder-Spot ist
    locked."

### Template 4: FounderCodeAtLaunch
- **Trigger:** Manual via `/scripts/launch-send-codes.ts`
- **Subject:** "Callday is live. Here's your founder code."
- **Inhalt:**
  - "Callday is now live in the App Store. As promised, here's your
    founder code:"
  - `{founder_code}` (prominent, monospace, copy-friendly)
  - "Your code locks in:
    - First month free
    - 50% off the standard price for life
    - Active as long as your subscription stays active"
  - **CTA:** Button "Activate your founder pricing" → callday.io/checkout?code=...
  - "If you've already been using the beta — your account stays. The code
    applies to your first paid month."

---

## API-Routes (callday-web)

### `/api/beta/apply` (POST)
- Input: Form-Felder
- Validierung: Pflichtfelder, Email-Format, `has_ios17 === true`
- DB-Insert applications mit `status='pending'`
- Inline-Trigger: Confirmation-Email via Resend
- email_logs-Eintrag
- Response:
  - `200 OK + { duplicate: true }` wenn Email bereits in DB
  - `200 OK + { success: true }` bei Erfolg
  - `400` bei Validation-Fail mit klarem Fehler-Detail

### `/api/email/send-testflight-invite` (POST, Webhook-Trigger)
- Auth: Supabase-Webhook-Signature-Verification
- Payload: `application_id` (from DB-Webhook)
- Idempotenz: Check `email_logs` für `email_type='testflight_invite'` + `application_id`
  — wenn schon vorhanden, no-op (verhindert doppelte Email bei Webhook-Retry)
- Loading Application → Resend.send → log
- Bei Fehler: `email_logs.status = 'failed' + error_message`, no crash

### `/api/email/send-launch-list-welcome` (POST, Webhook-Trigger)
- Identische Struktur wie testflight-invite, anderer Template

### `/api/stripe/webhook` (POST)
- Auth: Stripe-Signature-Verification
- Events:
  - `customer.subscription.created` → set `users.subscription_status = 'active'`
    + `applications.code_redeemed_at = NOW()`
  - `customer.subscription.updated` → status-sync
  - `customer.subscription.deleted` → `users.subscription_status = 'cancelled'`
- Wichtig: `users`-Table-Spalten ergänzen falls noch nicht da
  (`stripe_customer_id`, `subscription_status`, `subscription_plan`,
  `subscription_renews_at`)

### `/checkout` (Page)
- Query-Param: `?code=CALLDAY-XXXXXX`
- Validiert Code gegen Stripe API
- Erstellt Stripe Checkout Session mit pre-applied Promotion-Code
- Redirect zu Stripe-Hosted-Checkout
- Success-URL: `/checkout/success`, Cancel-URL: `/`

---

## Web-Login + Subscription-Bind

User-Identität muss zwischen App und Web matchen, damit die Sub auf den richtigen
Account geht.

**Approach:**
- Web-Login auf callday.io via Supabase Auth (Email/Password + Magic-Link)
- Bei Checkout-Start: User muss eingeloggt sein. Wenn nicht: Magic-Link zur
  Email aus der Application, dann automatisch zurück zum Checkout.
- Stripe Checkout Session bekommt `client_reference_id = supabase_user_id`
- Stripe-Webhook nutzt das, um Subscription dem Supabase-User zuzuordnen
- App liest `users.subscription_status` beim Login + Periodisch

**Edge-Case:** User hat noch keinen Supabase-Account (in der App nie eingeloggt
weil Beta gar nicht installed). Lösung: Beim ersten Magic-Link-Login wird User
mit der Email aus der Application angelegt; in der App später Apple/Google-Login
matched über Email.

---

## Launch-Day Script

`callday-web/scripts/launch-send-codes.ts`

**Funktionsweise:**
1. Lade `applications` mit `status IN ('approved', 'launch_list', 'active_beta')
   AND founder_code IS NULL`
2. Für jeden Eintrag:
   - Generiere Code: `CALLDAY-` + 6 random uppercase alphanumeric (collision-check
     via UNIQUE constraint, retry bei Konflikt)
   - Erstelle Stripe Promotion-Code zum `Founder 50% off forever`-Coupon mit
     diesem Code-String, `max_redemptions: 1`
   - Speichere `founder_code` + `stripe_promotion_id` in applications
3. Versende `FounderCodeAtLaunch`-Email an alle generierten Codes
   - **Bevorzugt: Resend Batch-API** (`emails.batch.send`, bis 100/Call) —
     kein eigenes Rate-Limiting nötig
   - Fallback bei mehr als 100: Chunking
4. Log jeden Versand in `email_logs`
5. Summary: "Generated X codes, sent Y emails, failed Z"

**Idempotenz:**
- Code wird nur erzeugt wenn `founder_code IS NULL` → Re-Run skippt vorhandene
- Email wird nur verschickt wenn KEIN `email_logs`-Eintrag mit
  `email_type='founder_code' AND application_id = ?` existiert
- Re-Run ist safe

**CLI:**
```bash
# Dry-Run (zeigt was passieren würde, schreibt nichts)
pnpm run launch:send-codes --dry-run

# Live-Run
pnpm run launch:send-codes
```

---

## Reihenfolge der Implementierung

### Phase 0 — Setup (vorher)

1. **Resend:** Domain `callday.io` verifizieren, `hello@callday.io` als Sender
   einrichten — DNS-Records bei Hostinger
2. **Stripe-Account:**
   - Produkte: Monthly (€24,99), Yearly (€199)
   - Coupon: "Founder 50% off forever" (`forever`, `50% off`, applies to both
     prices)
   - Webhook-Endpoint registrieren (vorerst Placeholder, später ersetzen
     wenn Route deployed ist)
3. **Supabase:**
   - Schema-Migration in `dealswipe-app/supabase/migrations/` schreiben
   - Im Studio anwenden (siehe Memory `reference_supabase_migrations.md`:
     manueller SQL-Editor-Deploy, kein CI)
   - `users`-Table um Stripe-Spalten erweitern (Migration zusätzlich)

### Phase 1 — Form + Confirmation (1.5h)

4. `/api/beta/apply` Route bauen
5. `ApplicationConfirmation`-Template
6. Bestehende Beta-Form auf callday.io an die Route anschließen
7. Test: Form-Submit → DB + Email empfangen

### Phase 2 — Status-Lifecycle-Emails (2h)

8. Database Webhooks im Supabase Studio konfigurieren:
   - Webhook 1: UPDATE applications WHERE status changed to 'approved' → POST
     `/api/email/send-testflight-invite`
   - Webhook 2: UPDATE applications WHERE status changed to 'launch_list' →
     POST `/api/email/send-launch-list-welcome`
9. Beide API-Routes + Templates bauen
10. Test: Status in Supabase Studio setzen → entsprechende Email kommt

### Phase 3 — Web-Sub-Flow (3h)

11. Supabase-Auth-Login auf callday.io (Email + Magic-Link)
12. `/checkout`-Page mit Code-Validierung + Stripe-Checkout-Session-Erstellung
13. `/api/stripe/webhook` mit Signature-Verification + Subscription-Status-Sync
14. Test: Code generieren (manuell in Stripe Dashboard) → Checkout → Webhook →
    Supabase-Status korrekt

### Phase 4 — Launch-Day Script (1h)

15. `scripts/launch-send-codes.ts`
16. `FounderCodeAtLaunch`-Template
17. Test mit 2-3 Test-Application-Einträgen + Dry-Run
18. Test idempotency: Re-Run schickt keine Duplicate-Emails

### Phase 5 — App-Side Integration (1h, im dealswipe-app Repo)

19. App liest `users.subscription_status` beim Login (vermutlich neue Query in
    `utils/queries/`)
20. Paywall-Trigger: wenn `BETA_MODE === false && subscription_status !== 'active'`
21. OTA-Update raushauen

### Phase 6 — Dokumentation (30min)

22. `BETA_ADMIN.md` in `callday-web/` mit SQL-Queries + Workflow:
    - Häufige SQL-Queries (Pending der letzten 7 Tage, Mit Website,
      Status-Updates)
    - TestFlight-Workflow: nach `approved` in Supabase, parallel App Store Connect
      öffnen + Tester adden
    - Launch-Day Runbook: Script-Aufruf + Validation
    - Trouble-Shooting: Email fehlgeschlagen, Code-Validation-Fail, etc.

---

## Geschätzter Gesamtaufwand

**~8-9h Vibe-Coding** verteilt auf 1-2 Tage.

- Phase 0: 1h (manuell, größtenteils Warten auf DNS-Propagation)
- Phase 1: 1.5h
- Phase 2: 2h
- Phase 3: 3h (Stripe-Setup + Webhook-Logic + Auth-Flow)
- Phase 4: 1h
- Phase 5: 1h
- Phase 6: 30min

Phasen 1+2 sind unabhängig vom Stripe-Setup und können vor Launch fertig sein.
Phasen 3-4 brauchen erst Stripe-Setup, also nicht parallel.

---

## Was bleibt manuell

**Pro Beta-User (~2 min):**
- Application in Supabase Studio reviewen
- Bei Approval: in App Store Connect Tester adden (Apple verschickt eigene
  TestFlight-Email mit Install-Link)
- Status in Supabase auf `approved` setzen (triggert unsere Welcome-Email)

**Zum Launch (~30 min):**
- `pnpm run launch:send-codes` ausführen
- Validation: Summary-Output prüfen
- Bei Fehlern: betroffene Codes manuell nachschicken (Script idempotent)

**Laufend:**
- Status-Lifecycle in Supabase Studio steuern (`approved` / `launch_list` /
  `declined`)

---

## Was läuft automatisch

- Form-Submit → DB + Confirmation-Email
- Status-Change → entsprechende Lifecycle-Email (via DB-Webhook)
- Launch-Email nach Script-Trigger
- Code-Redemption → Stripe-Webhook → Subscription-Status-Sync zu Supabase
- App liest Status beim Login → schaltet frei

---

## Out-of-Scope (später)

- **Affiliate-Marketing:** Rewardful/Tolt o.ä. auf den Stripe-Account
  draufschrauben — ~1h Setup nach Launch
- **Reminder-Emails:** "Beta läuft 2 Wochen, wie isses?" via pg_cron + Resend
- **Abandoned-Checkout:** Stripe-Recovery-Emails aktivieren
- **Email-Verification beim Application-Submit:** Magic-Link bevor `pending`
  wird — aktuell zu viel Reibung
- **Admin-UI auf callday.io:** Supabase Studio reicht solange das Volumen
  klein ist

---

## Geklärte Voraussetzungen

- ✅ **Stripe-Account:** vorhanden — Produkte/Coupon müssen noch konfiguriert werden, aber kein Onboarding nötig
- ✅ **TestFlight-Group für Beta:** vorhanden in App Store Connect
- ✅ **iOS-17-Disqualifier:** wird direkt im Anmeldeformular auf callday.io abgefangen (kein Backend-Reject nötig, kein `pending`-Eintrag für inkompatible Geräte)
- 📌 **Privacy/Terms auf callday.io:** offene Aufgabe, siehe Memory `project_legal_pages_callday_migration.md`

## Offene Punkte vor Start (Implementierungs-Detail)

1. **Beta-Welcome-Email vs Apple-TestFlight-Email — Reihenfolge:**
   Empfehlung: erst in App Store Connect adden (Apple-Email geht raus), dann
   Status auf `approved` setzen (Welcome-Email mit Anweisungen geht raus). So
   landet Apples Install-Link-Email vor unserer Erklärungs-Email — User installiert
   sofort, liest unsere Anweisungen währenddessen.
