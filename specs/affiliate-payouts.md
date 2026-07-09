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
| Migrationen `affiliate_commissions` (+ `affiliate_payouts`) | **dealswipe-app** | `supabase/migrations/` |
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
6. **Hold:** neuer Row setzt `hold_until = charged_at + 90d` (unveränderlich).
   Status pending/available wird daraus + `now()` ABGELEITET, nicht gespeichert
   (kein Cron; siehe §5).
7. **Clawback:** Refund/Chargeback → `clawback_at = now()` auf dem betroffenen
   Row (fällt sofort aus pending/available). RC-Refund-Signal verifizieren
   (vermutlich `CANCELLATION` mit `cancel_reason` = Refund-Indikator ODER
   dediziertes Event — gegen aktuelle RC-Doku prüfen, **Watch-Point**).
8. **Cancel resets bond:** Kündigt der User und re-subscribed später OHNE erneut
   über den Affiliate-Link zu kommen → keine neue Provision. *(v1-Vereinfachung:
   lifetime-solange-FK-present; die saubere Reset-Logik ist eine spätere
   Verfeinerung — als bekannte Lücke dokumentieren.)*
9. **Späte Chargebacks (> Hold, bis ~120 Tage):** mit zukünftigen Provisionen
   verrechnen (negativer Row). Bei Programm-Austritt offene Negativ-Salden
   erlassen.

## 5. Datenmodell — neue Tabelle `affiliate_commissions`

**Architektur-Prinzip: Status wird NICHT gespeichert, sondern abgeleitet.** Kein
mutabler `status`-Spalte + Cron, der pending→available flippt (Bug-Klasse:
verpasster/doppelter Lauf, Status↔Timestamp-Drift). Stattdessen: der Row hält nur
**unveränderliche Fakten** + zwei **event-getriebene** Timestamps; der Status ist
eine reine Funktion daraus + `now()`.

```sql
create table affiliate_commissions (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references affiliates(id),
  user_id           uuid not null references auth.users(id),
  -- Idempotenz: ein Commission pro RC-Event. `on conflict do nothing`
  -- fängt RC-Retries (RC redelivered 5xx bis 72h).
  source_event_id   text not null unique,
  source            text not null default 'revenuecat',  -- Zukunft: 'stripe'
  product_id        text,
  charge_amount_cents  int not null,      -- Bruttopreis des Charges
  charge_currency      text not null,     -- 'USD' | 'EUR' | …
  commission_cents     int not null,      -- = round(charge * 0.5)

  -- Unveränderliche Fakten (nach Insert NIE mutiert):
  charged_at        timestamptz not null,
  hold_until        timestamptz not null,  -- = charged_at + 90d, bei Insert gesetzt

  -- Event-getriebene Timestamps (die EINZIGEN Mutationen, je genau einmal):
  clawback_at       timestamptz,           -- gesetzt bei Refund/Chargeback
  paid_at           timestamptz,           -- gesetzt bei echter Auszahlung
  payout_id         uuid,                  -- gesetzt zusammen mit paid_at (FK → affiliate_payouts)

  created_at        timestamptz not null default now()
);

-- Kein gespeicherter Status → keine Status-Indizes.
create index on affiliate_commissions(affiliate_id);  -- Earnings-Query pro Affiliate (alle Rows)
create index on affiliate_commissions(user_id);       -- „prior commission?"-Check im Webhook
-- Bei Volumen (viele Affiliates) zusätzlich ein Partial-Index für die
-- Admin-„available across all affiliates"-Query — jetzt noch nicht nötig:
--   create index ... (affiliate_id, hold_until) where paid_at is null and clawback_at is null;
```

`user_id` = der EINE attributable Profile (siehe Phase B: das `userIds`-Array des
Webhooks wird auf genau ein Profil mit gesetztem `referred_by_affiliate_id`
reduziert).

**Status-Ableitung (reine Funktion, nie gespeichert):**

```
clawback_at IS NOT NULL   → 'clawback'   (storniert, zahlt nie)
paid_at     IS NOT NULL   → 'paid'
hold_until  >  now()      → 'pending'    (noch im 90-Tage-Hold)
hold_until  <= now()      → 'available'  (Hold vorbei, auszahlbar)
```

Der 90-Tage-Übergang ist damit ein *Vergleich* zur Query-Zeit, keine
*Zustandsänderung* — „available" ist in der Sekunde korrekt, in der `now()` über
`hold_until` läuft, ohne Job/Latenz. Nichts kann driften, weil es keinen Status
gibt, der falsch werden könnte.

**Bucket-Query (Affiliate-Earnings) — PRO WÄHRUNG gruppiert.** Wichtig:
`sum(commission_cents)` darf NICHT über Währungen hinweg summieren (USD-Cents +
EUR-Cents = Unsinn). Deshalb `group by charge_currency`; der Helper aggregiert
den `currencyBreakdown`:

```sql
select
  charge_currency,
  coalesce(sum(commission_cents)
    filter (where paid_at is null and clawback_at is null and hold_until >  now()), 0) as pending_cents,
  coalesce(sum(commission_cents)
    filter (where paid_at is null and clawback_at is null and hold_until <= now()), 0) as available_cents,
  coalesce(sum(commission_cents)
    filter (where paid_at is not null), 0) as paid_cents
from affiliate_commissions
where affiliate_id = $1
group by charge_currency;
```

**Währungs-Watch-Point:** Provisionen entstehen in der Charge-Währung
(US-first → viele USD). Payout an EU-Affiliates via PayPal ist EUR. Policy vor
dem Bauen festlegen: (a) pro Währung getrennt auszahlen, (b) beim Payout in EUR
normalisieren (FX-Snapshot). Für v1 mit DACH-Affiliates + überwiegend
EUR-Charges tolerierbar; dokumentieren.

## 6. Punch-Liste (Tickets in Reihenfolge)

### Phase A — Schema  *(dealswipe-app/supabase)*
- [ ] Migration: Tabelle `affiliate_commissions` (DDL oben). Additiv, RLS
      enabled ohne Policy = service-role-only (wie die anderen affiliate_*).
- [ ] `affiliate_commissions` reicht für den JETZT-Build (Read-only-Payout-Page).
      Die `affiliate_payouts`-Tabelle kommt mit Phase E (erst bei echter
      Auszahlung nötig) — dann aber **empfohlen, nicht optional** (Audit-Trail für
      echtes Geld, siehe Phase E).

### Phase B — Commission-Erzeugung  *(dealswipe-app/supabase/functions/revenuecat-webhook)*
- [ ] TS-Type `RevenueCatEvent` um `price_in_purchased_currency`, `currency`,
      `cancel_reason` erweitern.
- [ ] Neues Modul `commissions.ts` neben `index.ts` (Webhook schlank halten):
      `maybeAccrueCommission(event, userIds, supa)`.
- [ ] Nach dem erfolgreichen `profiles`-Update aufrufen. Logik:
  - [ ] Nur `PRODUCTION` + `period_type=='NORMAL'` + Typ ∈ {INITIAL_PURCHASE, RENEWAL}.
  - [ ] **`userIds`-Array → EIN attributabler Profile.** Der Webhook resolved ein
        Array (app_user_id + original_app_user_id + aliases). `profiles` für diese
        IDs laden, das mit gesetztem `referred_by_affiliate_id` nehmen (Aliases =
        eine Person). Keiner gesetzt → organisch → return. Commission bekommt
        genau diesen `user_id` + `affiliate_id`.
  - [ ] Affiliate laden; `status=='removed'` → return.
  - [ ] Attributionsfenster: erster bezahlter Charge muss ≤ `created_at + 90d`
        (bei Folge-Renewals überspringen — nur der Erst-Charge wird gegen das
        Fenster geprüft; Marker via „existiert schon ein Commission-Row für
        diesen user_id?").
  - [ ] Insert `affiliate_commissions` mit den Fakten (`charged_at`,
        `hold_until = charged_at + 90d`, Betrag, Währung) — KEIN Status-Feld.
        Idempotent über `source_event_id = event.id` (`on conflict do nothing`).
- [ ] **Fehler-/Reihenfolge-Semantik (money-critical):** Ablauf im Webhook =
      profiles-Update → Commission-Accrual → ERST DANN Event in
      `revenuecat_event_log` als processed loggen. Schlägt der Accrual-Insert fehl
      → Webhook gibt **5xx** zurück (Event NICHT geloggt) → RC retried → das
      `source_event_id`-Unique macht den Retry sicher (kein Doppel-Row). Niemals
      „profiles ok, Commission verloren, trotzdem 200". (Aktueller Webhook loggt
      direkt nach dem profiles-Update — das Log-Insert muss hinter den Accrual
      wandern.)
- [ ] Refund-Pfad: bei Refund-Event `clawback_at = now()` auf dem betroffenen
      Commission-Row setzen. **RC-Refund-Signal zuerst gegen Doku/Sandbox
      verifizieren.**
- [ ] Sandbox-E2E: RC-Sandbox-Purchase (Trial → Renewal → Cancel → Refund)
      durchspielen, Rows prüfen.

### Phase C — Hold → Available: NICHTS im Korrektheits-Pfad zu bauen (abgeleitet)
- [ ] Kein Cron. Der pending→available-Übergang entsteht aus `hold_until <= now()`
      zur Query-Zeit (§5). Kein Job, keine Latenz, nichts das driften kann.
- [ ] (optional, später) leichter Reconcile-Job (Summen gegen RevenueCat
      abgleichen, Anomalien melden) — reines Monitoring, nicht die Wahrheit.

### Phase D — Affiliate-facing Payout-Page  *(callday-web)*  ← „ins Dashboard einbauen"
- [ ] `lib/affiliate-commissions.ts`: `getAffiliateEarnings(affiliateId)` →
      { pendingCents, availableCents, paidCents, currencyBreakdown, rows }.
      Buckets via die abgeleitete Query aus §5 (kein Status-Feld lesen).
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

> **Update 2026-07-07 (2. Session) — Payout-Methoden vorgezogen + self-service.**
> Statt des ursprünglich hier geplanten admin-erfassten `affiliates.paypal_email`
> ist die Methoden-Erfassung als **self-service** gebaut (Migration **0041**
> `affiliate_payout_methods`, deployed): `payout_method` (`paypal|wise`) +
> `paypal_email` + `wise_account_holder/country/details` + je
> `*_test_sent_at`/`*_verified_at`. Der Affiliate gibt PayPal **oder** Wise
> selbst ein (`/affiliate/settings`), mit **zweiseitigem Verify-Handshake**
> (Admin schickt kleine Testüberweisung → `markPayoutTestSentAction`; Affiliate
> bestätigt Eingang → `confirmPayoutReceivedAction`; nur verifizierte Methode
> wird aktiv). Verify-State wird abgeleitet (wie der Commission-Status),
> Helper/Typen in `lib/affiliate-payout.ts`. Der Admin-Drawer zeigt die
> Zahldaten + Verify-State (Section „Payouts"). **Wise statt raw bank wire:**
> von DE/EUR aus sind US-Domestic-Rails (Venmo/Zelle/CashApp) nicht zahlbar und
> SWIFT-Wire frisst kleine Payouts — Wise deckt „aufs Konto" günstiger ab.
> **Noch OFFEN in Phase E:** die eigentliche Auszahlungs-Buchung (unten):
> `affiliate_payouts`-Tabelle, Admin-Payout-View (available pro Währung),
> `markCommissionsPaid`. Das `paypal_email`-Item ist durch 0041 erledigt.

- [ ] Migration `affiliate_payouts` (id, affiliate_id, currency, total_cents,
      method='paypal', external_ref (PayPal-Txn-ID), note, paid_at, created_at).
      **Empfohlen, nicht optional** — bei echtem Geld willst du den Audit-Trail:
      „am Datum X per PayPal-Txn R den Betrag Y an Affiliate Z gezahlt", der N
      Commission-Rows gruppiert. Schützt bei Disputes.
- [ ] Admin-Payout-View: alle Affiliates mit `available`-Summe **pro Währung**
      (Auszahlungs-Liste).
- [x] Affiliate-Detail: Zahldaten anzeigen (Admin-Drawer „Payouts"-Section,
      2026-07-07). Available-Betrag pro Währung im Drawer noch offen.
- [ ] Server-Action `markCommissionsPaid(affiliateId, currency)`: in EINER
      Transaktion `affiliate_payouts`-Row anlegen, dann `paid_at = now()` +
      `payout_id` auf alle gerade **available** Rows dieser Währung setzen
      (`where affiliate_id=$1 and charge_currency=$2 and paid_at is null and
      clawback_at is null and hold_until <= now()`). Idempotent per Konstruktion
      (bezahlte Rows treffen das Filter nicht mehr), service_role-gescoped.
- [x] `affiliates`-Tabelle um Payout-Felder erweitern — erledigt via Migration
      0041 als self-service `payout_method` + PayPal/Wise-Felder (siehe
      Update-Box oben), nicht als admin-erfasstes `paypal_email`.

### Phase F — Edge Cases + Härtung
- [ ] Late-Chargeback (> Hold, Row hat schon `paid_at`): `clawback_at` setzen →
      Row ist paid+clawback = überzahlt; Betrag mit der nächsten Auszahlung
      verrechnen (oder manuell bei kleiner Zahl). Die zwei unabhängigen
      Timestamps modellieren das, ohne dass ein Status-Enum in einen unmöglichen
      Zustand gerät.
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

1. ✅ **Währungs-Policy** — ENTSCHIEDEN 2026-07-08: single-currency **USD**-Ledger
   (alle Summen / Netting / Payout-Rechnung in USD), Anzeige kosmetisch, reale
   Landeswährung nur bei der Auszahlung via Wise/PayPal. Nicht die hier ehemals
   gelistete „pro Währung vs. EUR-Normalisierung"-Alternative, sondern ein
   USD-Ledger. Volle Architektur + Zukunfts-Feature (per-Affiliate-Anzeigewährung):
   `affiliate-currency.md`.
2. **RC-Refund-Signal** exakt gegen aktuelle RevenueCat-Webhook-Doku verifizieren.
3. **Commission auf Brutto vs. Netto** — Spec nimmt 50 % vom **Bruttopreis**
   (= €7 auf €14), bestätigen.
4. **Paused-Affiliate**: bestehende Referrals weiter verdienen? (Spec: ja;
   nur `removed` stoppt.)
5. **`PRODUCT_CHANGE`** (z.B. Monthly→Yearly-Wechsel): löst der eine Provision
   aus? Nur wenn Apple dabei sofort abbucht — sonst folgt eh ein `RENEWAL`.
   Spec-Default: NICHT als Trigger (nur INITIAL_PURCHASE + RENEWAL); gegen
   RC-Verhalten in der Sandbox verifizieren.

*(Erledigt: Hold-Release braucht keinen Cron — Status wird abgeleitet, siehe §5.
Bucket-Query summiert nicht mehr über Währungen. Webhook-Fehler-Semantik +
userIds→ein-Profil ergänzt. `affiliate_payouts` von optional auf empfohlen.)*

---

## 9. Hold-Verkürzung 90 → 30 Tage + Clawback-Netting (2026-07-09)

**Entscheidung (Jan):** Hold von 90 auf **30 Tage** — Affiliates schneller
auszahlen. Direkte Folge: mehr Refunds/Chargebacks landen NACH der Auszahlung
(Apple-Refund-Fenster ~90d, Chargebacks später), also wird „paid-then-refunded"
vom seltenen Edge-Case zu regelmäßig. Deshalb kommt das Clawback-Netting mit
rein — die zwei Entscheidungen sind **gekoppelt**.

### 9.1 Hold als Single-Source-Konstante
`COMMISSION_HOLD_DAYS = 30` in `lib/affiliate-commissions.ts`. Genutzt von:
Demo-Earnings, affiliate-facing Copy, und (Phase B) der Accrual
`hold_until = charged_at + COMMISSION_HOLD_DAYS`. `hold_until` bleibt PRO ROW
gespeichert (kein Read-Time-Compute) → Bestands-Rows behalten ihren Hold; die
Änderung wirkt nur auf neue Accruals. **Keine Migration.** — ✅ umgesetzt 2026-07-09.

### 9.2 Zwei Refund-Fälle (bewusst unterschiedlich)
| Fall | Bedingung | Verhalten |
|---|---|---|
| **In-Hold-Refund** | Refund bevor ausgezahlt (`paid_at IS NULL`) | Bestehend: `clawback_at` auf DERSELBEN Row → Status „Refunded", fällt aus allen Summen. Kein Geld geflossen, nichts zu verrechnen. |
| **Post-Payout-Refund** | Refund nachdem ausgezahlt (`paid_at IS NOT NULL`) | **Recovery nötig:** Affiliate wurde überzahlt → kompensierende Negativ-Buchung recovert den Betrag aus künftigen Earnings. |

### 9.3 Recovery-Datenmodell (Negativ-Buchung)
Eine Recovery = neue `affiliate_commissions`-Row:
- `commission_cents` **negativ** (z.B. −640).
- `hold_until = charged_at` (KEIN Hold — die Schuld steht sofort fest → sofort
  „available", reduziert den Payout-Topf).
- `paid_at = NULL`, `clawback_at = NULL` → derived-Status „available" (negativ).
- Referenz auf die Ursprungs-Row (neue Spalte `reverses_commission_id uuid`).
- Der ursprüngliche Paid-Row bleibt **`paid`** (die Auszahlung ist historischer
  Fakt) — NICHT umflaggen. Die Recovery-Row ist die Korrektur.

### 9.4 Verrechnung: von AVAILABLE, nicht pending
`net available = Σ(available commission_cents inkl. Negativen)`. Carry-forward:
wird net < 0, ist auszahlbar = $0 und der Negativ-Saldo bleibt stehen; künftige
positive Available-Rows zahlen ihn zuerst ab. **Pending bleibt brutto**
(unangetastet) — reift nur später in available, wo das Netting greift.
Begründung: nur available wird ausgezahlt; eine feststehende Schuld gegen
unsicheres Pending zu rechnen wäre falsch.

### 9.5 Read-Side
`computeEarnings` nettet Negative automatisch (available += negativer Betrag).
Zusatz: Carry-Display (net<0 → „$0.00 available · −$X.XX to recover from
upcoming earnings"). `getPayableByAffiliate` (Admin) = `max(0, net)` als
auszahlbar + Carry-Indikator.

### 9.6 Admin-RPC `mark_commissions_paid` — Netting-Redesign (⚠️ money-critical)
**Sanity-Check-Fund:** der aktuelle „UPDATE-claim → dann summieren"-Aufbau
BRICHT bei Netting. Wenn net ≤ 0, sind die Rows schon als paid gestempelt, aber
es darf kein Payout entstehen und die Negativen sollen CARRYen. Nötig:
1. Netto ZUERST berechnen (available inkl. Negative), OHNE zu claimen — mit
   `FOR UPDATE`-Lock auf den available-Rows (Concurrency).
2. Nur wenn `net > 0`: claimen (positive UND negative available Rows als paid
   stempeln — Negative werden im Payout „verbraucht") + Beleg mit `total = net`.
3. Wenn `net ≤ 0`: nichts stempeln, nichts auszahlen — Negative bleiben
   available und carryen gegen künftige Positive.

### 9.7 Display (affiliate-facing)
- Post-Payout-Refund erzeugt eine **separate rote „Refund adjustment −$X.XX"-Zeile**
  (Datum = Refund), Helper „A previously paid commission was refunded and
  recovered from your balance." Original-Paid-Row bleibt „Paid".
- „Available"-Card zeigt Netto; bei Carry-Negativ `$0.00` + Subline
  „−$X.XX to recover from upcoming earnings".
- In-Hold-Refund bleibt wie jetzt (Row → „Refunded", kein Negativ-Row).

### 9.8 Scoping (Sanity-Check-Empfehlung) — was JETZT vs. mit Phase B
- **✅ JETZT umgesetzt:** Hold-Wechsel (9.1) — Konstante + Copy + Demo.
- **⏸ Mit Phase B:** das Netting (9.2–9.7). Warum nicht spekulativ jetzt:
  1. Write-Side (Refund-Event → Recovery-Row) lebt im RC-Webhook (Phase B, ungebaut).
  2. Ohne Write-Side + echten Refund-Flow ist das Netting nicht E2E-testbar.
  3. Der `mark_commissions_paid`-Redesign (9.6) fasst gerade-verifizierten
     Geld-Code an — nicht gegen nicht-existente Daten umbauen.
  → Netting MIT Phase B bauen + End-to-End testen (Accrual → Payout → Refund →
  Recovery). Migration dann: Spalte `reverses_commission_id` auf
  `affiliate_commissions` + Negativ-Betrag erlauben.

### 9.9 Offene Policy
Offener Negativ-Saldo bei Programm-Austritt: erlassen (Kleinbeträge) oder
einfordern? Default-Empfehlung: erlassen unter einem Schwellwert (z.B. <$10),
sonst dokumentieren. Vor Launch mit Jan final.
