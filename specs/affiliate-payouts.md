# Affiliate Commission Tracking & Payouts — Architektur-Spec

> Status: **Planungs-Spec** (2026-07-07), noch nicht implementiert. Umsetzung
> überwiegend Post-Launch (echte Subscriptions gibt's erst nach IAP-Verdrahtung
> + Launch). Diese Datei ist die Punch-Liste, um das Affiliate-Provisions- und
> Auszahlungssystem vollständig im Eigenbau zu bauen.

## 1. Strategische Grundlage (Kurzfassung — Details in Memory)

Entscheidung 2026-07-07 (siehe Memory `project_beta_affiliate_program.md`,
Strategie-Update):

- **Eigenbau statt Tolt.** Provisions-Tracking + Auszahlung laufen komplett über
  eigene Infrastruktur.
- **Zahlung = Apple IAP via RevenueCat** (Stripe zum Launch raus, deferred).
  Damit ist RevenueCat die **einzige** Provisions-Quelle → EIN Webhook-Stream,
  keine Stripe+Apple-Doppel-Reconciliation.
- **Provisionsmodell:** 50 % recurring lifetime pro referiertem, zahlendem User.
- **Auszahlung:** manuell per PayPal bei kleiner Affiliate-Zahl (~20). Keine
  Payouts-API bis das Volumen es erzwingt.
- **Hold-Periode:** Apple 90 Tage (Refund-Kulanz), danach zur Auszahlung frei.

## 2. Repo-Layout (cross-repo — pro Task markiert)

| Teil | Repo | Pfad |
|---|---|---|
| Migration `affiliate_commissions` + pg_cron | **dealswipe-app** | `supabase/migrations/` |
| Commission-Erzeugung (RC-Webhook-Erweiterung) | **dealswipe-app** | `supabase/functions/revenuecat-webhook/` |
| Affiliate-facing Payout-Page („deine Earnings") | **callday-web** | `app/affiliate/payouts/` |
| Admin-Payout-Run (mark-paid, alle Affiliates) | **callday-web** | `app/[secret]/affiliates/` |
| Geteilte Query-Helper | **callday-web** | `lib/affiliate-commissions.ts` (neu) |

DB ist geteilt (eine Prod-Supabase). Migrationen physisch im App-Repo (Konvention,
dort läuft der Runner), auch wenn das Feature web-seitig lebt.

## 3. Ist-Zustand (worauf wir aufbauen)

- **`affiliates`** — `id, slug, name, email, status ('active'|'paused'|'removed'), founder_tier, first_login_at, last_login_at, created_at`.
- **`profiles.referred_by_affiliate_id`** (uuid, nullable FK → affiliates.id) — beim Web-Sign-up über `/a/[slug]` gesetzt. `profiles.created_at` ≈ Referral-Zeitpunkt.
- **`profiles`** Subscription-Spalten (vom RC-Webhook gepflegt): `subscription_status, subscription_plan, subscription_renews_at, plan, plan_type`.
- **RC-Webhook** (`supabase/functions/revenuecat-webhook/index.ts`): löst `app_user_id → Supabase user.id` auf (Client ruft `Purchases.logIn(userId)`), Fallback über `original_app_user_id` + `aliases`, filtert auf echte UUIDs. Idempotent via **`revenuecat_event_log`** (`event_id` unique). Hat `PRODUCT_PLAN_MAP`, liest `environment` (SANDBOX/PRODUCTION), `period_type` (TRIAL/NORMAL), `product_id`, `expiration_at_ms`.
- **Affiliate-Dashboard** (callday-web `app/affiliate/`): Cookie-Auth (`verifyAffiliateSession`), Hamburger-Nav, service_role-Reads. Geteilte Helper in `lib/affiliate-activity.ts`.

## 4. Commission-Regeln (Vertragslogik als Code-Regeln)

Quelle: Vertragskonditionen in `project_beta_affiliate_program.md`. Diese Regeln
sind die Spezifikation für die Webhook-Logik:

1. **Betrag:** `commission = round(charge_amount * 0.50)`. Betrag + Währung aus
   dem RC-Event (`price_in_purchased_currency` + `currency` — Felder existieren
   in RC's Payload, sind in der aktuellen TS-Type-Definition nur nicht
   deklariert). Fallback: Product→Preis-Map, falls Feld fehlt.
2. **Trigger:** ein Commission-Row pro **bezahltem** Charge:
   - `INITIAL_PURCHASE` mit `period_type == "NORMAL"` (Direktkauf ohne Trial)
   - `RENEWAL` mit `period_type == "NORMAL"` (jede Verlängerung, auch die erste
     nach Trial-Ende)
   - **KEIN** Commission bei `period_type == "TRIAL"` (kein Geld geflossen).
   - Nur `environment == "PRODUCTION"` (Sandbox überspringen).
3. **Attribution nötig:** nur wenn `profiles.referred_by_affiliate_id` für den
   User gesetzt ist. Sonst organisch → kein Row.
4. **Attributionsfenster (Sign-up → erste Conversion): 90 Tage.** Der ERSTE
   bezahlte Charge muss innerhalb `profiles.created_at + 90d` liegen, sonst keine
   Provision (verhindert, dass lange vergessene Sign-ups plötzlich triggern).
   Folge-Renewals danach sind unbegrenzt (lifetime).
5. **Affiliate-Status:** akkumulieren, solange `affiliate.status != 'removed'`.
   `paused` betrifft nur NEUE Attribution (passiert beim Sign-up); bestehende
   Referrals verdienen weiter. `removed` = Vertrag beendet → stop. *(Entscheidung
   bestätigen.)*
6. **Hold:** neuer Row = `status='pending'`, `hold_until = charge_date + 90d`.
7. **Clawback:** Refund/Chargeback innerhalb des Holds → betroffenen Commission-Row
   auf `status='clawback'`. RC-Refund-Signal verifizieren (vermutlich
   `CANCELLATION` mit `cancel_reason` = Refund-Indikator ODER dediziertes
   Event — gegen aktuelle RC-Doku prüfen, **Watch-Point**).
8. **Cancel resets bond:** Kündigt der User und re-subscribed später OHNE erneut
   über den Affiliate-Link zu kommen → keine neue Provision. *(v1-Vereinfachung:
   lifetime-solange-FK-present; die saubere Reset-Logik ist eine spätere
   Verfeinerung — als bekannte Lücke dokumentieren.)*
9. **Späte Chargebacks (> Hold, bis ~120 Tage):** mit zukünftigen Provisionen
   verrechnen (negativer Row). Bei Programm-Austritt offene Negativ-Salden
   erlassen.

## 5. Datenmodell — neue Tabelle `affiliate_commissions`

```sql
create table affiliate_commissions (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references affiliates(id),
  user_id           uuid not null references auth.users(id),
  -- Idempotenz: ein Commission pro RC-Event. Verhindert Doppel-Insert
  -- bei RC-Retries (RC redelivered 5xx bis 72h).
  source_event_id   text not null unique,
  source            text not null default 'revenuecat',  -- Zukunft: 'stripe'
  product_id        text,
  charge_amount_cents  int not null,      -- Bruttopreis des Charges
  charge_currency      text not null,     -- 'USD' | 'EUR' | …
  commission_cents     int not null,      -- = round(charge * 0.5)
  charged_at        timestamptz not null,
  status            text not null default 'pending'
                    check (status in ('pending','available','paid','clawback','reversed')),
  hold_until        timestamptz not null, -- charged_at + 90d
  released_at       timestamptz,          -- wann pending → available
  paid_at           timestamptz,          -- wann ausgezahlt
  payout_id         uuid,                 -- optional FK → affiliate_payouts
  created_at        timestamptz not null default now()
);

create index on affiliate_commissions(affiliate_id, status);
create index on affiliate_commissions(status, hold_until);
```

Optional (später, für Payout-Runs): `affiliate_payouts` (id, affiliate_id,
total_cents, currency, method='paypal', external_ref, paid_at, note).

**Währungs-Watch-Point:** Provisionen entstehen in der Charge-Währung
(US-first → viele USD). Payout an EU-Affiliates via PayPal ist EUR. Policy vor
dem Bauen festlegen: (a) pro Währung getrennt auszahlen, (b) beim Payout in EUR
normalisieren (FX-Snapshot). Für v1 mit DACH-Affiliates + überwiegend
EUR-Charges tolerierbar; dokumentieren.

## 6. Punch-Liste (Tickets in Reihenfolge)

### Phase A — Schema  *(dealswipe-app/supabase)*
- [ ] Migration: Tabelle `affiliate_commissions` (DDL oben). Additiv, RLS
      enabled ohne Policy = service-role-only (wie die anderen affiliate_*).
- [ ] (optional) Tabelle `affiliate_payouts` für spätere Payout-Runs.

### Phase B — Commission-Erzeugung  *(dealswipe-app/supabase/functions/revenuecat-webhook)*
- [ ] TS-Type `RevenueCatEvent` um `price_in_purchased_currency`, `currency`,
      `cancel_reason` erweitern.
- [ ] Neues Modul `commissions.ts` neben `index.ts` (Webhook schlank halten):
      `maybeAccrueCommission(event, userIds, supa)`.
- [ ] Nach dem erfolgreichen `profiles`-Update aufrufen. Logik:
  - [ ] Nur `PRODUCTION` + `period_type=='NORMAL'` + Typ ∈ {INITIAL_PURCHASE, RENEWAL}.
  - [ ] User → `profiles.referred_by_affiliate_id` laden; null → return.
  - [ ] Affiliate laden; `status=='removed'` → return.
  - [ ] Attributionsfenster: erster bezahlter Charge muss ≤ `created_at + 90d`
        (bei Folge-Renewals überspringen — nur der Erst-Charge wird gegen das
        Fenster geprüft; Marker via „existiert schon ein Commission-Row für
        diesen user_id?").
  - [ ] Insert `affiliate_commissions` (idempotent über `source_event_id = event.id`;
        `on conflict do nothing`).
- [ ] Refund-Pfad: bei Refund-Event den Commission-Row des betroffenen Charges
      auf `clawback` setzen. **RC-Refund-Signal zuerst gegen Doku/Sandbox
      verifizieren.**
- [ ] Sandbox-E2E: RC-Sandbox-Purchase (Trial → Renewal → Cancel → Refund)
      durchspielen, Rows prüfen.

### Phase C — Hold → Release  *(dealswipe-app/supabase)*
- [ ] pg_cron-Job (täglich): `update affiliate_commissions set status='available',
      released_at=now() where status='pending' and hold_until < now()`.
- [ ] pg_cron auf Supabase aktivieren (Extension) + Job registrieren.

### Phase D — Affiliate-facing Payout-Page  *(callday-web)*  ← „ins Dashboard einbauen"
- [ ] `lib/affiliate-commissions.ts`: `getAffiliateEarnings(affiliateId)` →
      { pendingCents, availableCents, paidCents, currencyBreakdown, rows }.
      (Geteilt, service_role, analog `getAffiliateActivity`.)
- [ ] Route `app/affiliate/payouts/page.tsx` (Cookie-Auth wie die anderen
      Affiliate-Seiten, `affiliateMainStyle`, Hamburger-Nav).
- [ ] `AffiliateNav.tsx`: Menüpunkt **„Payouts"** ergänzen.
- [ ] UI: zwei Stat-Cards **Pending** vs. **Available** (+ Paid-to-date), Liste
      der Commission-Rows (Datum, Betrag, Status), Hinweis auf Hold-Periode +
      PayPal-Auszahlungsrhythmus. Empty-State vor Launch (keine echten Charges).
- [ ] **Kein PII, kein Pricing-Leak:** zeigt nur die eigenen Provisionsbeträge
      des Affiliates (interne Info, OK).

### Phase E — Auszahlung (manuell)  *(callday-web `app/[secret]/affiliates`)*
- [ ] Admin-Payout-View: alle Affiliates mit `available`-Summe (Auszahlungs-Liste).
- [ ] Affiliate-Detail: PayPal-Email + available-Betrag anzeigen (Jan überweist
      manuell in PayPal).
- [ ] Server-Action `markCommissionsPaid(affiliateId)`: available → paid,
      `paid_at=now()`, optional `affiliate_payouts`-Row + `external_ref`
      (PayPal-Transaktions-ID). Idempotent, service_role-gescoped.
- [ ] `affiliates`-Tabelle um `paypal_email` erweitern (Onboarding erfasst sie).

### Phase F — Edge Cases + Härtung
- [ ] Late-Chargeback (> Hold): Negativ-Row + Verrechnung mit nächster
      Auszahlung (oder manuelles Handling bei kleiner Zahl).
- [ ] Reconcile-Skript: Summe `affiliate_commissions` vs. RevenueCat-Dashboard
      (regelmäßig, weil falsche Provisionen Vertrauen verbrennen).
- [ ] „Cancel resets bond"-Verfeinerung (Regel 8) — falls Missbrauch auftritt.
- [ ] Test-Plan: Trial-User (kein Commission), Direktkauf, Renewal, Refund
      im Hold (clawback), Refund nach Hold (Verrechnung), organischer User
      (kein Row), removed-Affiliate (stop).

## 7. Bewusst NICHT im Scope (v1)

- **Keine PayPal-Payouts-API** — manuell, bis Volumen es rechtfertigt (dann
  Freeze-Risiko + FX beachten, ggf. Wise). Siehe Strategie-Memo.
- **Kein Stripe-Pfad** — deferred (falls Web-Stripe zurückkommt: zweite `source`
  in `affiliate_commissions`, entweder RC als Aggregator oder separater
  Stripe-Webhook-Zweig).
- **Keine automatische Tax-Form-/1099-Logik** — EU-Affiliates, separater
  rechtlicher Weg (AGB-Anwalt).

## 8. Offene Entscheidungen vor Umsetzung

1. **Währungs-Policy** für Payouts (pro Währung vs. EUR-Normalisierung).
2. **RC-Refund-Signal** exakt gegen aktuelle RevenueCat-Webhook-Doku verifizieren.
3. **Commission auf Brutto vs. Netto** — Spec nimmt 50 % vom **Bruttopreis**
   (= €7 auf €14), bestätigen.
4. **Paused-Affiliate**: bestehende Referrals weiter verdienen? (Spec: ja;
   nur `removed` stoppt.)
5. **pg_cron vs. Vercel-Cron** für Hold-Release (Spec: pg_cron, DB-nah).
