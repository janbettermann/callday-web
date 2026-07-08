# Affiliate-Provisionen — Währungs-Architektur (Ledger vs. Display)

> Status: **Entscheidung getroffen 2026-07-08.** Umsetzung Post-Launch, zusammen mit
> dem Payout-System (siehe `affiliate-payouts.md`). Diese Datei hält die
> Währungs-Policy + die tragende Invariante fest, damit die spätere Umsetzung
> sauber bleibt — insbesondere das optionale Zukunfts-Feature „Affiliate wählt
> seine Anzeigewährung selbst".

## 1. Entscheidung (Kurzfassung)

- **Eine einzige Ledger-Währung: USD.** Alle Provisionen werden in USD
  zusammengerechnet, gehalten, verrechnet (Clawback-Netting) und
  ausgezahlt-gerechnet. Kein Multi-Währungs-Ledger, keine getrennten Töpfe pro
  Währung.
- **Anzeige auf dem Affiliate-Dashboard: zunächst ebenfalls USD** (Salden
  pending / available / paid).
- **Reale Landeswährung nur bei der echten Auszahlung** — Wise/PayPal rechnen
  EUR/GBP/… am Auszahltag um; der real gesendete Betrag steht auf dem Monatsbeleg.

**Begründung:** US-first-App, USD ist der Pricing-Anker (siehe CLAUDE.md), Kunden
+ erwartete Affiliate-Mehrheit sind US. Entspricht dem Branchenstandard — Rewardful
nutzt eine „display currency" fürs Dashboard + Affiliate-Salden und behält die
Original-/Settlement-Währung pro Transaktion; Tolt zahlt via Wise/PayPal in 60+
Währungen aus, Rechnung typischerweise am 15. jedes Monats. (Recherche
2026-07-08, Quellen unten.)

## 2. Das Architektur-Prinzip: zwei strikt getrennte Schichten

Das ist der Kern, der spätere Änderungen sauber hält:

| Schicht | Währung | Zuständig für |
|---|---|---|
| **Ledger** (Buchhaltung, die Wahrheit) | **immer USD** | Summen, pending/available, Clawback-Netting, Payout-Totale |
| **Display** (Präsentation) | konfigurierbar (jetzt: USD) | wie eine Zahl dem Betrachter *gezeigt* wird |

Display ist eine reine Funktion `(USD-Betrag, Zielwährung, Kurs) → angezeigte Zahl`.

### Die Invariante (nicht verhandelbar)

> **Geld wird für immer in USD gerechnet. Die Anzeigewährung ist reine
> Render-Kosmetik und darf niemals in die Verrechnung durchsickern.**

Sobald available / Clawback / Payout in einer anderen Währung *gerechnet* würde,
kehrt das Mehrwährungs-Chaos zurück (eine USD-Schuld gegen ein EUR-Guthaben zu
wechselnden Kursen = geht sichtbar nie auf). Solange „gerechnet in USD, angezeigt
in X" gilt, ist jede Anzeige-Währung ein triviales Read-Side-Feature.

## 3. Schema-Implikation (wichtig — aktuelles 0040 weicht ab)

Die bestehende Tabelle `affiliate_commissions` (Migration 0040, dealswipe-app)
speichert:

- `charge_amount_cents` + `charge_currency` — was der Kunde real zahlte (Original,
  bleibt erhalten; gut für Reconciliation, deckt sich mit Rewardfuls „settlement
  currency retained").
- `commission_cents` — aktuell dokumentiert als `round(charge * 0.5)` **in der
  Charge-Währung**. ⚠️ Das ist NICHT automatisch USD.

**Damit die Invariante aus §2 hält, muss der Betrag, über den summiert/genettet
wird, USD sein.** Das ist die konkrete Entscheidung, die beim Bau der
Accrual-Logik (Phase B im RevenueCat-Webhook, siehe `affiliate-payouts.md`) zu
treffen ist. Zwei gangbare Wege:

- **(A) Flat-USD pro Plan — empfohlen, am simpelsten.** Provision = fester
  USD-Betrag pro Plan-Tier (50 % des USD-Listenpreises), unabhängig davon, in
  welcher Währung der Kunde tatsächlich zahlte. `commission_cents` ist damit von
  Geburt an USD, **null** FX beim Entstehen. `charge_currency` dokumentiert
  weiter den Original-Charge (Reconciliation), bestimmt aber die Provisionshöhe
  nicht.
- **(B) Convert-at-Accrual — Rewardful-Stil.** Echte „50 % des tatsächlichen
  Charges", beim Entstehen zum Tageskurs in USD umgerechnet + eingefroren.
  Braucht eine FX-Quelle + einen gespeicherten Kurs auf der Zeile. Genauer, aber
  ein beweglicher Teil mehr.

Empfehlung: **(A)**. Zur Selbstdokumentation kann eine Spalte
`commission_currency` (Default `'USD'`) ergänzt werden, damit die Basis
self-describing ist statt „per Konvention USD".

## 4. Was jetzt schon richtig ist (die Tür bleibt offen)

Damit per-Affiliate-Anzeige später sauber nachrüstbar ist, braucht es — fast
alles ist vorhanden:

- ✅ Beträge als Integer-Cents + expliziter Währungscode (währungsagnostische
  Speicherung).
- ✅ Original-Charge-Währung pro Zeile (`charge_currency`, Migration 0040).
- ⬜ Kanonischer USD-Betrag pro Provision (siehe §3 — beim Accrual-Bau
  festzurren).
- ⬜ Auszahl-Belege (`affiliate_payouts`, noch zu bauen) speichern den **real
  gesendeten Betrag + Währung + Kurs + Provider-Txn** — immutable historische
  Fakten.

## 5. Zukunfts-Feature: Affiliate wählt seine Anzeigewährung

Rein **additiv**, Read-Side, **keine** Migration bestehender Daten. Was
dazukommt:

- Spalte `preferred_display_currency` auf `affiliates` (nullable, Default
  `'USD'`).
- Eine FX-Kurs-Quelle + ein kleiner Umrechnungs-Helper in der
  Präsentations-Schicht.
- Ein Währungs-Umschalter in `/affiliate/settings`.

Die Salden-Berechnung (`lib/affiliate-commissions.ts`) bleibt **unverändert** in
USD; nur die finale Formatierung im Page-Layer bekommt die Zielwährung
reingereicht.

### Guardrails beim Bau

1. **Live-Kurs → Salden wackeln** (pending „steigt" ohne neue Provision, nur weil
   der Kurs sich bewegt). Kurs-Politik bewusst entscheiden: live vs. monatlich
   eingefroren. Reine UX-Frage, kein Architektur-Blocker — deshalb aufschiebbar.
2. **Historie nie nachträglich umrechnen.** Alte Auszahl-Belege bleiben in der
   Währung, in der real überwiesen wurde. Nur *lebende* Salden (pending /
   available) folgen der Anzeige-Präferenz.
3. **Die Invariante aus §2 gilt weiter** — die Display-Präferenz nie in die
   Verrechnung ziehen.

## 6. Verweise

- Payout-System-Gesamtspec: `affiliate-payouts.md` (die dortige offene
  Entscheidung „Währungs-Policy", §8, ist mit diesem Dokument erledigt).
- Schema: dealswipe-app `supabase/migrations/0040_affiliate_commissions.sql`.
- Read-Side heute: `lib/affiliate-commissions.ts` — die `byCurrency`-Buckets
  kollabieren automatisch auf einen einzigen USD-Bucket, sobald die Accrual USD
  schreibt (kein Umbau nötig).
- Branchenstandard-Belege:
  [Rewardful — Choosing a display currency](https://help.rewardful.com/en/articles/6057044-choosing-a-display-currency),
  [Tolt — How do auto payouts work](https://help.tolt.com/en/articles/9924816-how-do-auto-payouts-work).
