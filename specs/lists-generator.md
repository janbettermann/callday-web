# Callday Lists — Web-Lead-Generator + Funnel — Spec

> Status: **Planungs-Spec (2026-07-09), noch nicht implementiert.**
> **Post-Launch Fast-Follow** — nicht launch-blockierend (die App launcht mit dem
> jetzigen CSV-Import wie sie ist; den kritischen Launch-Pfad Gate → RC-E2E →
> Native-Build → Submission nicht anfassen).

## 1. Was + Warum (Strategie)

Ein Web-Tool auf **`callday.io/lists`**, das über die **Outscraper-API**
Google-Maps-Lead-Listen generiert — fertig aufbereitet für Callday. Zweck ist
zweierlei:

1. **Lead-Beschaffung lösen** (der wundeste Punkt: „woher krieg ich eine
   Liste"). Löst zugleich das **Leere-App-Problem** — der #1-Drop-off bei
   „bring-dein-eigenes-Daten"-Calling-Apps.
2. **Akquise-Wedge / Funnel:** Einstieg ist eine **kostenlose Liste** im Moment
   der Motivation (kleiner Ask, sofortiger konkreter Wert). Dabei entsteht ein
   Callday-Konto; die Liste liegt danach schon in der App → Install + Trial →
   callen. Der Entry ist „nur schnell 'ne Gratis-Liste", der Zug ist die
   vorgeladene App.

## 2. Domain / Ort

- **Jetzt: Subpath `callday.io/lists`** — ein Next.js-Projekt, geteilte
  Supabase-Auth, genau wie das Affiliate-Dashboard unter `/affiliate` schon
  liegt. Kein neues Vercel-Projekt, kein Cookie-Domain-Sharing, kein
  Multi-Zone. Auth „for free" (gleiche Origin).
- **Später (Loslösung) = Subdomain + Callday-Sub-Brand, NICHT ein eigener
  neutraler Brand.** Konkret: `leadscraper.callday.io` (o. Ä.) mit Callday-Logo +
  Funktions-**Pille** im Header — exakt das Muster der `AffiliateNav` (Logo +
  „Affiliate"-Badge), hier „Leadscraper"/„Leads". Gibt „eigener Bereich, eigene
  Funktion" + eigene SEO-/Ads-Fläche, ohne einen zweiten Brand aufzubauen, und
  reitet auf Calldays Vertrauen.
  - **Warum kein neutraler Brand:** der Callday-Name **qualifiziert vor** (§11) —
    er filtert Richtung call-orientiertem Publikum. Maximale Neutralität würde die
    falschen (nicht-konvertierenden Gratis-Leecher) reinspülen.
  - **Technischer Preis der Subdomain:** das Supabase-Auth-Cookie muss auf
    `.callday.io` gescoped werden, damit der geteilte Login über
    `leadscraper.callday.io` ↔ App/Konto hält — das IST die „Kooperation". Kleine
    Config, kein Blocker; der Subpath (Phase 1) braucht das nicht.
  - Per Next.js-Rewrites/Domain-Config aus dem Subpath heraushebbar — **keine
    Einbahnstraße** (auch ein voll-neutraler Brand bleibt offen, falls Daten je
    zeigen, dass der Callday-Name Cold-Call-Sucher abschreckt — unwahrscheinlich).

## 3. Front-Door (auth-aware, ein Konto)

`/lists` rendert je nach Zustand (wie die Landing per `useIsLoggedIn`):

- **Eingeloggt →** direkt in den Generator, keine Landing dazwischen.
- **Ausgeloggt →** kompakter, **list-spezifischer Hero** („Cold-Calling-Liste in
  2 Minuten, erste 500 gratis") **+ die bestehende `SignupForm`/Account-Card**
  (Apple/Google/Email).

**Kein zweites Auth-System** — dieselbe Supabase-Auth → **ein Konto** für App,
Affiliate und Lists. Wer sich über `/lists` mit Google registriert, hat damit
automatisch ein Callday-Login. Der Hero verkauft das **Listen-Tool**, nicht die
Calling-App (das ist der Wedge, der auch Leute reinzieht, die eigentlich nur
eine Liste wollen).

## 4. Der Funnel (Schritt für Schritt)

1. **Entry:** `/lists`, Hero pitcht die Liste + „erste 500 gratis".
2. **Signup** (Google one-tap / Apple / Email) — Gate für die Gratis-Liste;
   fängt Account + E-Mail ein.
3. **Generieren:** Branche + Ort (+ Anzahl) → Outscraper-Job.
4. **Ergebnis:** Liste **frei als CSV downloadbar UND automatisch ins
   Callday-Konto gesynct.** Im Ergebnis-Moment wird die App als *besseres
   Zuhause* merchandised: „Deine Liste liegt schon in Callday — dort anrufen,
   **erster Call gratis**, Outcomes werden automatisch getrackt."
5. **Aktivierung:** App installieren → **14-Tage-Free-Trial** → Liste ist
   **vorgeladen** → callen.
6. **Monetarisierung:** greift die bestehende Pricing-Logik
   (`first call's on us` → Paywall nach dem ersten Outcome, Enforcement am
   zweiten Dial; siehe App-Repo `specs/paywall-first-call-gate.md`) **plus**
   bezahlte Folge-Listen (§7).

## 5. Free-Liste — Download/Gate-Regeln (bewusste Entscheidung)

- **Erste Liste gratis** (z. B. 500 Leads), **frei als CSV downloadbar + App-Sync
  — KEIN Download-Gate.** Ein „zum Runterladen zahlen" auf der Gratis-Liste
  fühlt sich nach Bait an und vergiftet Vertrauen + Mundpropaganda (den
  Treibstoff des Funnels).
- **Wertabgriff = der Signup**, nicht die Sperre. Selbst „CSV greifen und weg" =
  Account + E-Mail gefangen → Re-Engagement per Mail.
- **Cap: 1 Gratis-Liste pro Konto** (schützt Outscraper-Kosten + Missbrauch).
- **Die App gewinnt auf Merit** (Calling-UX, first-call-free, Outcome-Tracking),
  nicht per Zwang.
- **Folge-Listen sind bezahlt**; dort ist CSV-Export selbstverständlich (gekaufte
  Daten gehören dem User) — kein Gate nötig.
- **Free-Größe ist eine Stellschraube** (nicht in Stein): die Gratis-Menge
  (z. B. 100–250 vs. 500) tradet Hook-Stärke gegen Kosten-/Leak-Exposure.
  Kleiner aktiviert immer noch („meine Leads sind schon in der App"), kostet aber
  weniger pro Nicht-Konvertierer. Mit Conversion-Daten tunen (siehe §11).

## 6. Outscraper-Integration (verifiziert aus OpenAPI v0.4.3)

- **Base-URL:** `https://api.outscraper.cloud`
- **Endpoint:** `POST /google-maps-search` (GET auch möglich; POST für größere
  Payloads / viele Queries).
- **Auth:** Header `X-API-KEY` — **strikt server-seitig** (nie im Client).
- **Async:** `async=true` (Default) → Task abschicken, Ergebnis via
  **`webhook`-Param** (Outscraper POSTet JSON an unsere Callback-Route, sobald
  fertig; ~1–3 Min) — Alternativ Polling via `GET /requests/{requestId}`
  (Ergebnisse 4 h vorgehalten). **Wir nutzen den Webhook.**
- **Params:** `query` (z. B. `"Zahnärzte, Köln, DE"`), `limit` (≤ 500/Query;
  `10` = schnellste Antwort), `skipPlaces` (Pagination in 20er-Schritten),
  `language`, `region`, `enrichment` (u. a. `leads_n_contacts` findet
  Emails/Kontakte von Websites — kostet extra), `fields` (Felder eingrenzen),
  `format` (`json`).
- **Response-Felder pro Eintrag:** `name`, `phone`, `site`, `full_address`,
  `postal_code`, `category` (+ `rating`, `reviews`, `working_hours`,
  `business_status`).
- **QPS ~20** (skalierbar auf Anfrage). Offizielle **Node-SDK** vorhanden (oder
  plain `fetch` gegen den REST-Endpoint).
- ⚠️ **OFFEN — Preis:** die Outscraper-Pricing-Seite blockt den Fetcher (403).
  Die €/1.000-Zahlen (sekundär: ~$3/1.000 Basis, ~$6 mit Email-Enrichment) **vor
  dem Kostenmodell live im eingeloggten Dashboard bestätigen.**

## 7. Datenmapping (Outscraper → Callday `leads`)

Reuse der **bestehenden Import→`lead_list`→`leads`-Pipeline** (Outscraper ist nur
eine neue *Quelle*, die Zeilen im selben Shape erzeugt — kein neues Subsystem).

| Outscraper | Callday `Lead` |
|---|---|
| `name` | `company_name` |
| `phone` | `phone` |
| `site` | `website` |
| `full_address` | `location` |
| `category` | `industry` |
| `email` (nur mit `leads_n_contacts`) | `email` (optional) |
| — (bei Business-Listings meist leer) | `contact_name` |

Insert als neue `lead_list` (Name = Query, z. B. „Zahnärzte Köln") + zugehörige
`leads`. `is_sample = false` (echte User-Liste, keine Demo).

## 8. Architektur / Backend

- **Key server-seitig.** Empfehlung: **callday-web Route Handlers** (Next.js API
  Routes), NICHT eine separate Supabase Edge Function — die Route lebt im selben
  Projekt, hat den Auth-Kontext + `service_role`, und die öffentliche
  Vercel-URL taugt direkt als Webhook-Ziel. (Edge Function wäre nur nötig, wenn
  die *Mobile-App* Outscraper direkt riefe — tut sie nicht.)
- **Flow:**
  1. `/lists`-UI → `POST /api/lists/generate` (mit Session) — validiert Cap +
     baut die `query`.
  2. Route ruft Outscraper (`async=true`, `webhook=<callday.io/api/lists/webhook>`),
     legt eine „pending" Liste an, gibt Job-Ref zurück.
  3. **Webhook-Route** `POST /api/lists/webhook` empfängt die Ergebnisse →
     mappt (§7) → inserted `lead_list` + `leads` via `service_role`, **gescoped
     auf den user** → markiert die Liste „ready".
  4. UI zeigt **Pending-State** („Liste wird gebaut, ~1–3 Min") und pollt/lauscht
     (Supabase Realtime), bis „ready".

## 9. Sync — WATCH-POINT #1 (technisch entscheidend)

Die Mobile-App ist **offline-first (lokale SQLite) ← Supabase-Sync**. Eine im
Web erzeugte Liste liegt zunächst nur in Supabase → **die App muss
server-erzeugte Listen RUNTERZIEHEN.** Wenn der aktuelle Sync push-dominant ist
(Device → Supabase), ist **das Pull-für-server-erzeugte-Listen genau das Stück,
das gebaut werden muss.** Vor allem anderen im Sync-Pfad verifizieren — sonst
generiert der User im Web, aber am Handy kommt nichts an. (Related Memory:
`feedback_local_db_single_tenant`.)

## 10. Monetarisierung / Billing

- **Gratis:** 1 Liste/Konto (im Funnel).
- **Bezahlte Folge-Listen:** à-la-carte **via Stripe im Web** — **kein
  Apple-Cut.** (In-App-Consumables auf iOS = 15–30 % IAP + Regeln; deshalb ist
  der Web-Kanal der bessere Ort fürs à-la-carte-Listen-Geld.) Stripe wurde für
  den Launch rausgenommen (Apple-IAP-only) → **Wieder-Einführung für Web-Listen
  ist eine bewusste Post-Launch-Entscheidung**, deferred.
- **Haupt-Umsatz bleibt das App-Abo** ($14.99/mo). Listen sind ein Zweitstrom +
  Akquise, nicht der Kern.

## 11. Zielgruppen-Qualität + Unit Economics — WATCH-POINT #2

Jede Gratis-Liste kostet echtes Outscraper-Geld pro Signup → das ist ein
**bezahlter Akquisekanal in Verkleidung.** Kennzahl:
`Kosten-pro-Free-Liste ÷ Conversion-zu-Trial/Paid`. Signup-Gate + 1er-Cap
schützen die Basis; trotzdem **monitoren**.

**Breite ≠ besser — Qualität schlägt Reichweite.** Solange das Ziel
*Funnel-in-Callday* ist, sind unqualifizierte List-Sucher (z. B. für
E-Mail-Marketing-Listen) **Kosten, kein Asset**: sie ziehen die Gratis-Liste und
verschwinden, ohne je zur App zu werden. Konsequenzen:

- **Brand als Qualifizierer:** der Callday-Sub-Brand (§2) filtert bewusst
  Richtung call-orientiertem Publikum — Feature, kein Bug.
- **SEO + Ads scharf auf Cold-Calling-Intent**, nicht generisch:
  - ✅ „cold calling lead list", „b2b sales call list", „telemarketing leads",
    „Kaltakquise Telefonliste"
  - ❌ „email marketing list", „email leads", generisches „lead list / scraper"
  - Enger = bessere Ökonomie (jeder Free-List-Dollar geht an App-passende Leute).
- **Free-Größe als Kosten-Hebel** (§5): kleiner = weniger Exposure pro
  Nicht-Konvertierer.

**Abgrenzung:** das gilt fürs Ziel *Funnel*. Ein eigenständiges *Zahl*-Geschäft
mit Listen (breites Publikum zahlt für Listen, unabhängig von Callday) wäre eine
**separate, spätere, unbewiesene Wette** — nur wertvoll, wenn diese Leute
wirklich *zahlen* (Instinkt: die meisten nehmen gratis und gehen). Für v1 nicht
chasen; Fokus = qualifizierter Cold-Calling-Traffic.

## 12. Recht / Compliance

- **Cold-Calling-Regeln (DE §7 UWG):** B2B braucht mutmaßliche Einwilligung, B2C
  praktisch verboten. Leads liefern verschiebt die Pflicht nicht — sie bleibt
  beim Anrufer —, aber „Liste holen + direkt callen" in einem Ökosystem sollte
  in den **AGB** einen Compliance-Hinweis kriegen (User verantwortlich).
- **Scraping-ToS** liegt bei Outscraper (sie sind der Scraper). DSGVO: v. a.
  B2B-Geschäftsdaten — sauber dokumentieren; AGB-Anwalt drüber (ohnehin für das
  Affiliate-Onboarding im Loop).

## 13. Bewusst NICHT v1 / offen

- **Kein volles zweites Marketing-Site-Ding** — das ist die Spin-out-Phase
  (eigene Subdomain/Brand).
- **Outscraper-Preis** live bestätigen (§6).
- **Stripe-Wiedereinführung** für Folge-Listen: Post-Launch (§10).
- **Email-Enrichment** (`leads_n_contacts`) optional + teurer — später zuschaltbar.
- **Raw-CSV bei bezahlten Listen** ist Standard; bei der Gratis-Liste auch (§5).

## 14. Verweise

- Pricing/Paywall-Kette: Memory `project_pricing_strategy`, App-Repo
  `specs/paywall-first-call-gate.md`.
- Auth-aware Landing + `SignupForm`: Memory `project_callday_web_auth_aware_landing`,
  `project_landing_light_redesign`.
- Outscraper: OpenAPI v0.4.3 (lokale Datei / `docs.outscraper.com`), offizielle
  Node-SDK (`npm i outscraper`).
- Sync/Tenant: Memory `feedback_local_db_single_tenant`.
