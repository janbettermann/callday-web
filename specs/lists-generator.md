# Callday Lists — Web-Lead-Generator + Funnel — Spec

> Status: **v1 GEBAUT (2026-07-12) auf Branch `lists-generator`, E2E-verifiziert
> gegen echte Outscraper-API + Prod-DB.** Merge in `main` = bewusste
> Go-Live-Entscheidung **nach dem App-Launch** (Post-Launch Fast-Follow,
> nicht launch-blockierend — den kritischen Launch-Pfad nicht anfassen).
>
> Gebaut: `/lists` (3 Zustaende, auth-aware), `/api/lists/{generate,webhook,
> status,download}`, `lib/lists/*` (Outscraper-Client, Callable-Pipeline,
> Job-Verarbeitung), `emails/list-ready.tsx`, Migration `0048_lead_gen_jobs`
> (App-Repo, deployed), SignupForm `nextPath`-Prop. Offen vor Merge:
> `OUTSCRAPER_API_KEY` in Vercel, App-CTA von /account auf App-Store-Link
> umstellen, SignupForm-Card-Copy (TestFlight-Text) fuer Launch pruefen.

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

## 9. Sync — ✅ VERIFIZIERT (2026-07-11): Pull existiert bereits

Die Mobile-App ist **offline-first (lokale SQLite) ← Supabase-Sync**. Der
ursprüngliche Watch-Point („wenn der Sync push-dominant ist, muss der Pull erst
gebaut werden") ist **im App-Code verifiziert und erledigt**:
`utils/sync/pull-from-cloud.ts` läuft bei jedem Boot + Foreground-Wechsel und
zieht `lead_lists`, `leads`, `call_outcomes`, `notes` vollständig per
`INSERT OR REPLACE` in die lokale DB (paginiert, orphan-defensiv). Eine
server-erzeugte Liste landet also **ohne Sync-Neubau** beim nächsten
App-Öffnen auf dem Gerät.

Was der Web-Insert dafür korrekt setzen muss:

- richtige `user_id` (RLS + Pull-Scope) und `is_sample = false`
- Legacy-Batch-Defaults wie beim App-Import: `batch_size = total_leads`,
  `current_batch = 1`, `total_batches = 1`, `batch_number = 1`
- `position_in_batch` = Import-Reihenfolge (Sort-Order in Stack + Listview)

**Timing-Erwartung:** „gesynct" = beim nächsten App-Start/Foreground, kein
Live-Push aufs Gerät. Für den Funnel reicht das (Install → Open → Liste da);
Live-Erscheinen bei offener App bräuchte einen Extra-Trigger (Realtime oder
Push-Notification → Pull). (Related Memory: `feedback_local_db_single_tenant`.)

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

## 12. Affiliate-Synergie

Der Funnel upgradet das Affiliate-Programm — Affiliates bekommen einen viel
bewerbbareren Haken.

- **Lead-Magnet statt App-Pitch:** „kostenlose Cold-Calling-Leads in 2 Minuten"
  ist im Social-Content (dem Affiliate-Kanal) massiv teilbarer/klickbarer als
  „lad die Calling-App". Besserer Content-Angle („so zieh ich mir gratis Leads")
  und zieht die qualifizierte (Cold-Calling-)Zielgruppe = genau die, die
  konvertiert.
- **Ganzer-Funnel-Monetarisierung:** Affiliate-Link → Listen-Tool → Signup setzt
  `referred_by_affiliate_id` (geteilte Auth) → der Affiliate verdient 50 %
  recurring, sobald der User zum zahlenden Callday-Abo wird. Der einfache
  Gratis-Haken zahlt auf die bestehende Provision ein.

**Zwei Dinge, die dafür sitzen müssen:**

1. **Attribution muss durch den `/lists`-Signup fließen.** Die Zuordnung wird
   beim Web-Signup über `/a/[slug]` gesetzt (siehe App-Repo-Spec-Kontext /
   `affiliate-payouts.md` §3) — der Listen-Tool-Signup muss den Referral-Cookie/
   -Param genauso respektieren, sonst kriegt der Affiliate den Signup nicht
   gutgeschrieben. **Konkreter Integrationspunkt.**
2. **Free-Listen-Kosten × Affiliate-Volumen (Watch-Point-Interaktion):**
   Affiliate-getriebene Gratis-Listen kosten *dich* Outscraper-Geld pro Signup,
   und Affiliates sind auf Volumen incentiviert. Die Provision zahlt nur bei
   Conversion (kein Bleed für Nicht-Konvertierer), aber die Free-Listen-Kosten
   fallen bei *jedem* Affiliate-Signup an. Der 1er-Cap (§5) + Per-Affiliate-
   Monitoring (Dashboard zeigt Sign-ups vs. Activated) fangen das ab — beobachten,
   falls ein Affiliate viel Low-Quality-Volumen reindrückt.

## 12b. Meta-Ads-Experiment (Post-Launch, Jan-Decision 2026-07-12)

Der Lead-Magnet taugt fuer Paid Social (demobarer Sofort-Wert,
Screen-Recording-Creatives, Preset-Link `/lists?website=without` + UTM
als Landing). **Ads ergaenzen die Affiliates, ersetzen sie nicht** —
entgegengesetzte Risikoprofile: Affiliate = 0 € bis zur Conversion
(50 % recurring pro Erfolg), Meta = Kosten pro Versuch. Owned-Acquisition
wird erst bei bewiesenen Funnel-Zahlen strukturell guenstiger.

**Voraussetzungen bevor Budget fliesst:**
1. App-Launch (gleiche Gate wie Affiliate-Bewerbung).
2. **Arbeitspaket Tracking:** Meta-Pixel/CAPI auf callday.io mit
   Conversion-Events (Signup, Liste generiert). Achtung: Site ist
   bisher bewusst cookieless — Pixel braucht in DACH ein
   Consent-Banner (eigenes Paket). Ad→App-Store→Abo-Attribution ist
   auf iOS strukturell loechrig → auf Web-Events optimieren,
   Abo-Conversion als Kohorten-Wert in RevenueCat gegenpruefen.
3. **Klein testen statt Kampagne:** 10–20 €/Tag, 3–4 Creatives
   („ohne Website"-Hook vs. generischer Listen-Hook), 2 Wochen.
   Skalieren erst bei Payback < ~3 Monaten
   (CPL × Signup→Install × Trial→Paid gegen 14,99 $/mo).

**Synergie:** Affiliate-Content ist das Creative-Labor — organisch
funktionierende Creator-Videos per Whitelisting/Spark-Ads zur Anzeige
machen (schlaegt selbstgebaute Ads fast immer).

## 13. Recht / Compliance

- **Cold-Calling-Regeln (DE §7 UWG):** B2B braucht mutmaßliche Einwilligung, B2C
  praktisch verboten. Leads liefern verschiebt die Pflicht nicht — sie bleibt
  beim Anrufer —, aber „Liste holen + direkt callen" in einem Ökosystem sollte
  in den **AGB** einen Compliance-Hinweis kriegen (User verantwortlich).
- **Scraping-ToS** liegt bei Outscraper (sie sind der Scraper). DSGVO: v. a.
  B2B-Geschäftsdaten — sauber dokumentieren; AGB-Anwalt drüber (ohnehin für das
  Affiliate-Onboarding im Loop).

## 13b. Website-Filter + Anreicherung (gebaut 2026-07-12)

- **Website-Filter** („All / Without a website / With a website") im
  Generator-Form — der Ziel-Filter fuer die KI-Website-Builder- und
  Agentur-Zielgruppe. Client-seitig in der Pipeline (Outscrapers
  Quick-Filter sind UI-only, API unterstuetzt sie nicht —
  Staff-bestaetigt im Outscraper-Forum). Affiliate-Link-Preset:
  `/lists?website=without` waehlt den Filter vor.
- **Gratis-Anreicherung aus dem Basis-Response:** `google_rating`
  (auf der Pre-Call-Card via custom_field_defs enabled=true),
  `opening_hours` + `google_profile_claimed` (leise als Custom Fields).
  Shape identisch zum CSV-Import (App types/lead-list.ts).
- **Leadcard-Preview im Ready-State:** erster echter Lead als
  stilisierte Callday-Karte (Stack-Optik, Rating-Zeile) — verkauft das
  Erlebnis, nicht nur die Daten. Bewusst vereinfacht, kein
  pixelgenauer App-Zwilling.
- **Backlog (App-Seite, Post-Launch):** „No website"-Filter als
  zusaetzliche FilterPill in der Listen-Ansicht der App (Jan-Idee
  2026-07-12) — Filter gehoeren in den Browse-Modus, NICHT in den
  Karten-Stack (Anti-Prokrastination). Daten liegen lokal
  (leads.website), kein Sync-Thema. Bei groesseren Maerkten +
  Filter-Undershoot: `skipPlaces`-Pagination als Tiefenscan-Ausbau.
- **Geplante Optimierung: Zwei-Phasen-Fetch fuer gefilterte
  DACH-Laeufe** (Jan-Einwand 2026-07-12, berechtigt): Client-Filter
  bezahlt den vollen Raw-Scan — bei 5 % Trefferquote ~$1,20 pro Liste
  fuer 20 Leads; auf Kampagnen-Volumen (1.000 Listen/Monat) vierstellig
  vermeidbar. Loesung OHNE en-Zwang: (1) `language=en` + Server-Filter
  → nur Treffer werden geliefert/berechnet, nur `place_id`s verwenden;
  (2) place_ids als Batch-Query mit `language=de` nachladen (bis 1.000
  Queries/Request) → deutsche Labels, City-Sort intakt. Extremfall
  $0,12 statt $1,20. Preis: zweite Async-Stufe im Job (Latenz +
  State). **Trigger:** vor DACH-Meta-Kampagne ODER >~200 gefilterte
  DACH-Listen/Monat in lead_gen_jobs. **Billing-Annahme VALIDIERT (2026-07-12, Jans
  Usage-Dashboard):** El-Paso-Filter-Lauf (15 Treffer bei Scan-Limit
  500) wurde mit exakt 15 Records abgerechnet; Fahrschulen-Koeln
  (unfiltered, DE) mit 119 = zurueckgegebene Records. Outscraper
  berechnet IMMER das Gelieferte, nie das Scan-Limit — die
  Zwei-Phasen-Oekonomie rechnet exakt wie geplant.

## 14. Bewusst NICHT v1 / offen

- **Kein volles zweites Marketing-Site-Ding** — das ist die Spin-out-Phase
  (eigene Subdomain/Brand).
- **Outscraper-Preis** live bestätigen (§6).
- **Stripe-Wiedereinführung** für Folge-Listen: Post-Launch (§10).
- **Email-Enrichment** (`leads_n_contacts`) optional + teurer — später zuschaltbar.
- **Raw-CSV bei bezahlten Listen** ist Standard; bei der Gratis-Liste auch (§5).

## 15. Verweise

- Pricing/Paywall-Kette: Memory `project_pricing_strategy`, App-Repo
  `specs/paywall-first-call-gate.md`.
- Auth-aware Landing + `SignupForm`: Memory `project_callday_web_auth_aware_landing`,
  `project_landing_light_redesign`.
- Outscraper: OpenAPI v0.4.3 (lokale Datei / `docs.outscraper.com`), offizielle
  Node-SDK (`npm i outscraper`).
- Sync/Tenant: Memory `feedback_local_db_single_tenant`.
