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

## 2b. Architektur-Update 2026-07-13 (v2): Listen-Welt unter /lists, /account zeigt nur hin

Ersetzt die Vormittags-Entscheidung „Generator in der Account-Sektion"
noch am selben Tag (Jan): /account soll Verwaltungsseite bleiben und
nicht mit Produkt-Features wachsen — die Listen-Welt lebt komplett
unter `/lists` (haelt auch den spaeteren Subdomain-Spin-out §2 als
sauberen Schnitt offen).

- **`/lists` ausgeloggt** — unveraendert die Akquise-Landing
  (Message-Match fuer Affiliate-/SEO-Traffic; `ListsClient`). Signup
  fuehrt jetzt direkt in den Generator (`nextPath=/lists/new`,
  Presets reisen mit).
- **`/lists` eingeloggt** — die Listen-Uebersicht (`MyLists`),
  server-gerendert (SSR-Auth wie /account, kein Client-Swap).
  **Karten-Redesign 2026-07-16 (Jan):** Karten im Dashboard-Design
  (`fetchAllLists` liest `lead_lists`, Demo via `is_sample` aus,
  Progress-Logik mit dem Dashboard geteilt) — Name, Quelle-Pill oben
  rechts (`Generated` = hat einen Generator-Job / `Imported` = App-
  Datei-Import), Fortschrittsbalken, „x / y leads in list". Ein
  laufender Job sitzt als pollende Building-Card oben (pulsierender
  Punkt + „Building your list…", durchlaufende Ladeanimation im Balken
  gleicher Groesse). **Raus:** In-Page-„New list"-Button (die AppNav
  traegt ihn), Subtext unter h1, Download-Aktionen, „Call them with the
  app"-Card, Synced-Badge. Filter-Toggles (all/synced/imported) bewusst
  weggelassen — bei „alles synced" haetten sie leeren/identischen
  Inhalt; die Quelle-Pill traegt die Info stattdessen pro Karte. Kommt
  ein eingeloggter Besucher mit `?website=`-Preset (Affiliate-Link =
  Generate-Intent), wird er zu /lists/new durchgereicht.
  - **Offen (Jan 2026-07-16, bewusst vertagt):** Fehlgeschlagene
    Generierung ist **kein** eigener Karten-Zustand — sie erscheint nur
    noch als Empty-State-Hinweis (wenn sonst keine Liste da ist). Spaeter
    ggf. vierter Zustand: rote `Failed`-Pill + „Retry" statt Balken.
- **`/lists/new`** — der Generator als eigene Workspace-Seite
  (`GeneratorClient`): Konsolen-Layout (Formular links, Live-Summary
  rechts, die spaeter Credits-Kosten + Enricher-Zeilen traegt),
  How-it-works-Pipeline-Strip; Building-State zeigt dieselben Stufen
  ehrlich zustandsgesteuert (pending = Scan, processing = Pipeline,
  keine Fake-Timer). **Eine URL, keine Ready-Ansicht** (Jan-Entscheidung
  2026-07-14): ist die Free-Liste verbraucht (`ready`), bleibt der
  Generator sichtbar, aber gesperrt — Formular ausgegraut
  (`.lists-console.is-locked`), darueber Hinweis-Karte warum + Link zu
  /lists; Client-Guard ist nur Gurt, den Cap erzwingt weiter der
  partial unique index (409). Wird der Job in derselben Session fertig,
  leitet die Seite zu /lists weiter — die fertigen Listen wohnen dort
  (Download-Buttons seit dem Karten-Redesign 2026-07-16 aus der UI raus,
  `/api/lists/download` bleibt bestehen). Die fruehere Ready-Ansicht
  samt LeadPreviewCard (§13b) ist ersatzlos raus, Git-History als
  Re-Impl-Vorlage.
- **/account** (`LeadListsSection`, jetzt Server-Component ohne
  Polling) — kompakter Zeiger statt Generator: keine Liste/failed →
  Promo-Card („Get your first lead list — free" → /lists/new, haelt
  das Leere-App-Problem fuer App-Signups geloest — ein Klick mehr,
  Versprechen bleibt); Job laeuft → Status-Zeile → /lists; Liste
  fertig → Listen-Zeile + „View your lists".
- **Zustandsgesteuert statt herkunftsgesteuert** gilt weiter — beide
  Funnel sehen dieselben Zustaende, nur eben auf /lists(/new) statt
  auf /account.
- Offen (bewusst nach hinten gestellt): „first list free"-Kommunikation
  auf der App-Landing (Jan macht Copy/Platzierung separat).

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
- **Re-affirmiert 2026-07-12:** Die Idee „Download weg, Liste nur in der
  App" (mehr Install-Druck) wurde geprüft und **verworfen** — Bait-
  Wahrnehmung vergiftet Affiliate-Glaubwürdigkeit + Word-of-Mouth
  (Affiliates bewerben nichts, was ihre Kommentarspalte zerlegt),
  Markt-Standard ist Liste=Datei, und Desktop-Traffic sähe eine
  Sackgasse. Der App-Push läuft stattdessen über die Abo-Credits (§10):
  Der Generator wird für Abonnenten zum wiederkehrenden Abo-Feature —
  Zwang durch Wert ersetzt.

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

## 6b. Outscraper-Funktionsweise — empirisch verifiziert (2026-08-05)

Jan + Claude haben die Mechanik mit echten Läufen (Dashboard + roher API-Call)
ausgemessen. Diese Fakten sind die Grundlage für Multi-Location/State-Support
(§14b) — **nicht erneut herleiten, hier nachlesen.** Ausführliche Fassung inkl.
aller Testdaten: Memory `reference_outscraper_architecture`.

### API = wörtliche Durchreiche, KEIN server-seitiges Tiling

- Eine Text-`query` = exakt **eine** Google-Maps-Suche. Beweis:
  `"dentist, Bayern, DE"` mit `limit=500`, `language=de`, `region=DE`
  (roher API-Call, identisch zu unserem Generator-Pfad) lieferte **59 Records**
  — die eine Suche war erschöpft, alle 59 Zeilen tragen unveränderten
  unseren Query-String. Kein Auffächern, keine Sub-Queries.
- Das PLZ-Tiling, das man vom Dashboard kennt, ist ein **Client-Feature des
  Dashboard-Formulars**: Der Standort-Baukasten (Land>State>Stadt>PLZ, 4
  Ebenen, Mehrfachauswahl) generiert die Micro-Queries VOR dem Submit
  (Task-Metadata: `useZipCodes: true`, `locations: [...]`, `queries_amount` —
  Köln→45 Queries, Essen→32). Der Dashboard-Toggle „Einfache Abfragen" =
  Rohmodus, entspricht unserem API-Pfad.
- Micro-Query-Format (aus echten Dashboard-Exports):
  `zahnarzt, 45131, Essen, Nordrhein-Westfalen, DE` — falls wir Fan-out je
  selbst bauen, ist DAS die Vorlage.
- Die API nimmt **mehrere Queries pro Request** an; `dropDuplicates`
  dedupliziert dann über die Queries hinweg (reduziert doppelt bezahlte
  Records an Gebietsgrenzen). `skipPlaces` = manuelle Pagination in
  20er-Schritten innerhalb EINER Query (Reihenfolge über Wochen nicht
  garantiert stabil → nur Kosten-Optimierung, nie Korrektheits-Anker).

### Suchtiefe + State-Queries

- Google deckelt eine Einzelsuche bei grob ~120 Listings (deshalb baut
  Outscraper das PLZ-Tiling überhaupt). Unser Bayern-Lauf versiegte bei 59.
- **State als eine Query ist unbrauchbar** — nicht nur flach, sondern
  unzuverlässig: „dentist, Bayern, DE" lieferte 22/59 Treffer in BERLIN
  (Google matchte u. a. „Bayerische Str." in Wilmersdorf!), Rest fast nur
  München, 20 Records ohne Kategorie. State-Support geht nur über Fan-out
  (§14b).
- ⚠️ OFFEN: Maximal-Tiefe einer Einzel-**Stadt**-Query (z. B.
  `dentist, Köln, DE` ohne Filter bis zum Versiegen) ist ungemessen — bei
  Bedarf ~$1 Testlauf; relevant für „Max list size"-Erwartungen bei
  Ein-Stadt-Listen.

### Ranking-Jitter + language-Effekt auf die Firmen-Menge (A/B 2026-08-05)

Drei Läufe `dentist, Köln, DE` limit 50 (en / de / de-Kontrolle):
- **Zwei IDENTISCHE de-Läufe teilen nur 35/50 Betriebe (70%)** — Googles
  Ranking würfelt pro Lauf. Konsequenzen: (a) `skipPlaces`-Fortsetzung
  ist unzuverlässig (Reihenfolge schon zwischen zwei Läufen instabil) —
  der eigene Ausschluss-Filter ist der EINZIGE verlässliche
  Fortsetzungs-Mechanismus; (b) Overlap-Vergleiche zwischen Läufen nie
  ohne Kontroll-Lauf interpretieren.
- **en vs de: 29–31/50 Overlap** — gegen die 70%-Baseline fast
  vollständig Jitter. Die Firmen-MENGE ist praktisch sprachunabhängig,
  Qualität identisch (46–47/50 korrekt).
- **Roh-API anglisiert NICHT:** `address` sagt auch bei `language=en`
  „Köln"/„Straße"; `category` kommt immer im Lokal-Label. Das
  „Cologne" stammte aus der geparsten city-Spalte des DASHBOARDS.
  Das City-Sort-Argument für language=de ist damit hinfällig.
- **Absicherungs-Stichproben (gleicher Tag):** Wien (Exonym-Härtetest):
  en-Lauf 50/50 Adressen „Wien", 0× „Vienna"; Kategorien bleiben auch
  unter en lokal („Elektriker" 30/50). Paderborn (Kleinstadt): en-Lauf
  lieferte 50, de-Lauf nur 34 — en ist gleich gut oder ERGIEBIGER.
  `working_hours`-Tages-Schlüssel lokalisieren als einziges Feld
  (en→„Monday", de→„Montag") — gelöst durch Intl-Mapping in der
  Pipeline.
- **ENTSCHEIDUNG (Jan, 2026-08-05): JEDER Markt läuft mit `language=en`
  + Server-Filtern** (`with_phone`, `operational_only`, Website-Filter
  wenn gesetzt). Umgesetzt in generate/route.ts; Pipeline übersetzt
  Tages-Namen via Intl in die Markt-Sprache (pipeline.ts, alle
  LANGUAGE_OVERRIDES-Sprachen abgedeckt, unbekannte Keys Passthrough).
  Kostenhebel: Website-Filter-Läufe (~5 % Trefferquote) liefern und
  berechnen nur Treffer — Faktor ~20 bei „without"-Listen, wichtig
  weil der Filter als Marketing-Feature beworben wird und mit
  Credits/Multi-Location 500er-Listen über mehrere Bundesländer
  realistisch werden. Der Sprach-Hybrid (§13b) und der Zwei-Phasen-
  Fetch-Plan (§13b unten) sind damit OBSOLET.

### Sprache: drei getrennte Achsen (nicht verwechseln!)

1. **`language`-Param**: gated Server-Features — Quick-Filter
   (`only_without_website` etc.) und „exact match categories" gibt es NUR
   bei `language=en`. Auf die Ergebnis-Daten wirkt er (entgegen der
   alten Annahme) fast nicht: Adressen + `category` bleiben lokal, nur
   `working_hours`-Tage lokalisieren. **Seit 2026-08-05 immer „en"**
   (Entscheidung oben); der frühere Sprach-Hybrid ist Geschichte.
2. **Query-Text** ist sprachtolerant: Google matcht semantisch auf die
   interne Kategorie. A/B-verifiziert (je limit 50, alle voll geliefert):
   Dentist/Essen 49/50 korrekt vs. Zahnarzt/Essen 47/50; Tax
   consultant/Köln 41/50 vs. Steuerberater/Köln 44/50. Deutsche Begriffe
   sind in DACH NICHT schlechter — englische Kanonik gewinnt wegen
   **Markt-Universalität** („Dentist" geht überall, „Zahnarzt" nur DACH),
   nicht wegen Qualität. (Niedrige Overlaps zwischen den A/B-Läufen waren
   Tiling-Artefakte — verschiedene ZIP-Kacheln —, kein Sprach-Effekt.)
3. **Outscrapers Kategorie-SYSTEM ist englisch verankert**: Die vordefinierte
   Kategorienliste kennt „zahnarzt" nicht (Dashboard bietet nur
   „als neue Kategorie hinzufügen"; Task-Metadata flaggt deutsche Begriffe
   als `includesForeignCategory: true`). Deutsche Begriffe laufen als
   Custom-Freitext — funktionieren als Text-Suche, hängen aber außerhalb
   der Kategorie-Features.

### Billing (erneut bestätigt)

- Abgerechnet werden **gelieferte Records** ($3/1k), nie das Scan-Limit —
  Bayern-Test: 59 geliefert ≈ $0,18 trotz limit 500. (Bei aktivem
  Server-Filter zählt `limit` gescannte Plätze, geliefert/bezahlt werden
  nur Treffer — wie gehabt, §13b.)

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

## 10. Monetarisierung — Abo-Credits (ENTSCHEIDUNG 2026-07-12, ersetzt Stripe-à-la-carte)

Folge-Listen laufen NICHT über Einzelkäufe, sondern als **Abo-Benefit**:
Callday-Abonnenten bekommen **500 Generator-Leads pro Monat** als Credits.

- **Warum statt Stripe à la carte:** braucht **keine Web-Zahlung** — das
  Abo läuft wie geplant über Apple-IAP, die Credits sind ein Entitlement
  daraus. Die „Stripe-Wiedereinführung?"-Frage stirbt damit komplett.
  COGS trivial: 500 Leads ≤ ~$1,50 gegen $14.99 Abo (<10 %, real weniger
  — Stadt-Pools sind kleiner, und nicht jeder schöpft aus).
- **Stacking als Churn-Bremse:** ungenutzte Credits rollen über — Loss
  Aversion (Kündigen = gesammelte Credits verlieren), und es entschärft
  nebenbei das bewusst fehlende Pause-Feature (ruhige Monate sammeln
  wenigstens Wert an). **Rollover-Cap: 3 Monatsrationen (1.500)** — für
  die Lesbarkeit des Versprechens, nicht wegen der Kosten.
- **Zahl: mit 500 starten, nicht 1.000** — erhöhen ist später ein
  Geschenk, senken ein Skandal.
- **Kommunikation von Anfang an** (Jans Bedingung): Paywall-Bullet
  („500 fresh leads every month"), Import-Trigger, Account-Listen-Card
  („Need another list?" wird für Abonnenten zum echten Generate-Button).
- **Free-User:** unverändert 1 Gratis-Liste/Konto (§5) — Funnel bleibt.
- **Verbrauchseinheit:** gelieferte Leads pro Job (lead_count) — dieselbe
  Einheit, nach der Outscraper uns berechnet (validiert §12b/13b).
- **Umsetzung (Post-Launch, ~2–3 Tage, erst NACH IAP-Verdrahtung):**
  Credits-Ledger (Tabelle + monatliche Gutschrift), Abo-Status web-seitig
  (RevenueCat-Webhook → profiles), Metering in der Generate-Route,
  Credit-Anzeige in Account-Card + /lists.
- **Haupt-Umsatz bleibt das App-Abo** — Credits machen das Abo wertiger;
  Listen sind bewusst kein eigener Umsatzstrom mehr.

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

- **Website-Filter** im Generator-Form — der Ziel-Filter fuer die
  KI-Website-Builder- und Agentur-Zielgruppe. Client-seitig in der
  Pipeline (Outscrapers Quick-Filter sind UI-only, API unterstuetzt
  sie nicht — Staff-bestaetigt im Outscraper-Forum).
  Affiliate-Link-Preset: `/lists?website=without` waehlt den Filter
  vor. **Seit 2026-07-15 Dropdown statt Chips** (Jan-Entscheidung
  gegen meine Chips-Empfehlung, bewusst getroffen) mit den
  eindeutigen „Only…"-Labels („With and without website / Only
  without website / Only with website"). Default bleibt „With and
  without" — „Only with website" als Default wurde geprueft und
  VERWORFEN (haette im Beauty-Salon-Testlauf 38 % anrufbarer Betriebe
  gekostet, fuer einen E-Mail-Bonus der ~25 % der Leads hilft). Die
  Wirkung der Wahl spiegelt das Summary-Panel. **Rating-Filter
  (gut/schlecht bewertet) wurde diskutiert und bewusst rausgelassen**
  (2026-07-15) — waere gratis via `google_rating` client-seitig
  machbar, liegt im Backlog (Undershoot-Wechselwirkung + Umgang mit
  Betrieben ohne Rating dann mitentscheiden).
- **Gratis-Anreicherung aus dem Basis-Response:** `google_rating`
  (auf der Pre-Call-Card via custom_field_defs enabled=true),
  `opening_hours` + `google_profile_claimed` (leise als Custom Fields).
  Shape identisch zum CSV-Import (App types/lead-list.ts).
- **Leadcard-Preview im Ready-State** *(2026-07-14 wieder entfernt:
  der Ready-State ist der One-URL-Entscheidung in §2b gewichen —
  LeadPreviewCard + `preview` im Status-Endpoint liegen in der
  Git-History als Re-Impl-Vorlage, falls die Karte mal auf /lists
  oder der Landing wiederkommt)*: erster echter Lead als stilisierte
  Callday-Karte (Stack-Optik, Rating-Zeile) — verkauft das Erlebnis,
  nicht nur die Daten.
- **Backlog (App-Seite, Post-Launch):** „No website"-Filter als
  zusaetzliche FilterPill in der Listen-Ansicht der App (Jan-Idee
  2026-07-12) — Filter gehoeren in den Browse-Modus, NICHT in den
  Karten-Stack (Anti-Prokrastination). Daten liegen lokal
  (leads.website), kein Sync-Thema. Bei groesseren Maerkten +
  Filter-Undershoot: `skipPlaces`-Pagination als Tiefenscan-Ausbau.
- ~~**Geplante Optimierung: Zwei-Phasen-Fetch fuer gefilterte
  DACH-Laeufe**~~ — **OBSOLET seit 2026-08-05:** Alle Maerkte laufen
  jetzt direkt mit `language=en` + Server-Filtern (§6b, Entscheidung
  Jan) — die A/B-Tests zeigten, dass die Anglisierung, die der
  Zwei-Phasen-Plan vermeiden sollte, im Roh-API-Adressfeld gar nicht
  existiert. Die Oekonomie-Zahlen unten bleiben als Beleg gueltig
  (jetzt ohne zweite Async-Stufe erreicht). Historischer Plan: (1)
  `language=en` + Server-Filter nur place_ids; (2) Batch-Reload mit
  `language=de`. **Billing-Annahme VALIDIERT (2026-07-12, Jans
  Usage-Dashboard):** El-Paso-Filter-Lauf (15 Treffer bei Scan-Limit
  500) wurde mit exakt 15 Records abgerechnet; Fahrschulen-Koeln
  (unfiltered, DE) mit 119 = zurueckgegebene Records. Outscraper
  berechnet IMMER das Gelieferte, nie das Scan-Limit — die
  Zwei-Phasen-Oekonomie rechnet exakt wie geplant.

## 13c. Email-Enrichment — Testlauf-Erkenntnisse (2026-07-12)

Live-Test `enrichment=leads_n_contacts` (10 Fahrschulen Koeln, echte
API). Ergebnis: funktioniert, gehoert als **bezahltes Add-on** auf
Folge-Listen — mit vier Erkenntnissen fuer die Umsetzung:

1. **Preis verifiziert:** $3/1.000 **Domains** (Abrechnungseinheit ist
   die gecrawlte Website, nicht der Lead). Leads ohne Website kosten
   nichts und liefern nichts — fuer „ohne Website"-Listen ist das
   Add-on strukturell wertlos (dort ist Telefon der einzige Kanal =
   Callday-Verkaufsargument). Voll angereicherter Lead inkl.
   Verifikation (~$3/1k Mails extra): unter 1 Cent.
2. **Zeilen-Explosion:** Mit Enrichment liefert Outscraper EINE ZEILE
   PRO GEFUNDENER E-MAIL (10 Firmen → 19 Zeilen). Pipeline muss auf
   einen Lead zurueckfalten: primaere Mail waehlen, weitere Mails in
   ein Custom Field.
3. **Domain-Rauschen:** Der Crawler sammelt ALLE Adressen einer Domain
   und ordnet sie jedem Eintrag auf dieser Domain zu (Filial-Mails
   landen bei der falschen Filiale; Webagentur-/Partner-Adressen aus
   dem Footer tauchen auf). Noetig: Plausibilitaets-Stufe — Adressen
   bevorzugen, deren Domain zur Lead-Website passt.
4. **Copy-Vorsicht:** Personen-Namen mit Rolle kamen NICHT mit
   (`name_for_emails` = bereinigter Firmenname). Dafuer tauchen echte
   private Inhaber-Postfaecher auf (GMX-Fund im Test). Versprechen
   fuers Add-on: „E-Mails direkt von der Firmen-Website, inkl.
   persoenlicher Postfaecher wo vorhanden" — NICHT „Decision-Maker-
   Namen", bis ein groesserer Test Namens-Ausbeute belegt.

## 13d. Enrichment-Endstand + Phasenplan (Jan-Entscheidungen 2026-07-15)

Ersetzt die „bezahltes Add-on"-Rahmung aus §13c: **Leads & Contacts
laeuft IMMER, auch auf der Free-Liste. Keine Enricher-Auswahl, nie
Kacheln.** Grundlage: 285-Zeilen-Analyse eines 6-Enricher-Laufs
(Beauty Salons US, 200 Betriebe) — SimilarWeb/BuiltWith/Company
Insights/Emails Validator liefern fuer Kaltakquise Rauschen
(107 von 213 Spalten Tech/Traffic-Muell, Insights matcht Plattformen
statt Betriebe, 66 % der Kosten bei 3 % Nutzwert). Ein
Kaltakquisiteur kann eine Enricher-Auswahl nicht qualifiziert
treffen — abgewaelzte Entscheidung, keine Freiheit. Whitepages
Phones geparkt als spaeteres Credits-Upsell („Wer hebt ab?").
Emails Validator bleibt als SERVER-seitiges Werkzeug in der
Hinterhand (20 % der gefundenen Adressen INVALID, ZInfo-Quelle 52 %) —
falls Prefill-Qualitaet enttaeuscht, Validator nur auf den
Prefill-Kandidaten, nie als Nutzerentscheidung.

**E-Mail-Feld-Konzept** (Zweck: geschlossene Frage am Telefon fuer
die Meeting-Bestaetigung — „Ist jeannie@… noch richtig?"):

- Aggregation nach `place_id` ZUERST (faengt die Zeilen-Explosion,
  85 Dubletten im Testlauf), Kandidaten sammeln (Adresse + Quelle),
  Quellen serverseitig auf Enum normalisieren
  (`website | facebook | linkedin | directory | guessed | other`).
- Prefill-Prioritaet: (1) Domain == Website-Domain, (2) Freemail mit
  konservativem Firmennamen-Match, (3) sonst LEER. `guessed`/
  Fremd-Domains nie vorbefuellen; gilt auch fuer Einzel-Kandidaten
  (eine einzelne `domainnames@regiscorp.com` gehoert nicht ins Feld).
  Platzhalter-Blacklist (`hi@mystore.com`-Square-Template).
- Realistische Erwartung: ~20–25 % der Leads bekommen einen Prefill
  (37/200 Domain-Match im Test; ohne Website 0 % E-Mails, mit
  Website 79 % ≥1). Der Hauptfall ist das leere Eingabefeld.

**Phasenplan:**

- **Phase 0 (✅ 2026-07-15):** Website-Filter als Dropdown mit
  „Only…"-Labels; Google-Maps-Quelle in Landing-Sub + Metadata
  („We scan Google Maps…"). KEIN „Scraper" in Titel/Pille/Nav, kein
  Google-Pin-Asset (Marken-/Optik-Entscheidung).
- **Design-Update Formular (✅ 2026-07-15, Jan):** Generator im
  v2-Card-Look — weisse, umrandete Felder statt grauer beta-Insets
  (scoped auf `.lists-console-form`; Landing-/Auth-Formulare behalten
  den iOS-Settings-Look), ein Formular als Card. **Live-Summary
  (Checkmark-Liste + Price-Free) und How-it-works-Strip ersatzlos
  raus** — Mobile-first-Argument: das Panel saesse dort eh unterm
  Formular; eleganter loesen, wenn Credits-/Enricher-Zeilen wirklich
  kommen. Die ehrliche E-Mail-Notiz lebt jetzt als
  `.lists-field-hint` direkt unterm Website-Dropdown (nur bei „Only
  without website").
- **Phase 0b (✅ 2026-07-15):** Kategorien-Autocomplete fuers
  Industry-Feld (`IndustryAutocomplete` + `lib/lists/gmb-categories.ts`).
  Bewusst KURATIERTE ~280er-Liste im GMB-Stil (englisch, singular)
  statt der vollen ~4.000er-GMB-Liste — Cold-Calling-taugliche
  Branchen, kein Bahnhofs-Rauschen. Freitext bleibt immer gueltig
  (Query ist Text-Suche); Haekchen = erkannte Kategorie, pur aus dem
  Wert abgeleitet. Chips (INDUSTRY_SUGGESTIONS) auf GMB-Singular
  ausgerichtet, damit sie das Haekchen treffen; Chips leben jetzt in
  der Komponente (suggestions-Prop).
- **Phase 1 (✅ 2026-07-15):** `leads_n_contacts` immer an (ein
  Request-Pfad, `enrichments` in startGoogleMapsSearch), Aggregation
  nach place_id + Prioritaetsregeln in `lib/lists/emails.ts` (pure,
  getestet), Prefill in `lead.email` (kein Schema-Change,
  `schema_field_sources.email` ergaenzt), Summary-Zeile („Emails
  where we find them" / „No emails — these businesses have no
  website"). **Live verifiziert** (3 Mini-Laeufe, Cent-Bereich):
  API liefert `email`/`source`/`place_id` pro Zeile (Shape wie
  UI-XLSX), Felder ueberleben den `fields`-Filter, E2E ueber die
  echten lib-Funktionen: 26 Zeilen → 8 Leads, 5/8 Prefill
  (Physio Boise; B2B-Vertical deutlich ueber Beauty-Quote).
  Nebenbefunde: (a) `full_name` kommt bei linkedin/appolo-Quellen
  MIT (widerspricht §13c-Notiz „keine Personen-Namen" — war
  de-Markt); contact_name-Prefill waere moeglich, bewusst NICHT in
  Phase 1. (b) `raw_count` am Job zaehlt jetzt Enrichment-Zeilen,
  nicht Betriebe (Vergleich raw vs. lead_count entsprechend lesen).
- **Beobachtungs-Gate:** 2–3 echte Listen — Prefill-Quote und
  -Fehlerrate messen. Nur bei Bedarf weiter.
- **Phase 2 (Cross-Repo, 1–2 Tage, NUR nach Gate):**
  `leads.email_candidates` (jsonb, additiv, nur Cloud→App-lesend),
  lokale Migration + Sync-Pull + Shape-Contract beidseitig,
  Kandidaten-Auswahl-Sheet im Post-Call-Meeting-Form (Source-Label
  klein unter jeder Adresse, kein natives Picker-Experiment),
  XLSX-Kandidaten-Spalten.

**Bewusst verworfen** (nicht wieder aufrollen ohne neue Datenlage):
Enricher-Kacheln/-Auswahl; „Only with website" als Default;
„Google Maps Scraper" als Seitentitel/Pille (SEO-Keyword gehoert in
einen Blog-Artikel, nicht in den Produkttitel); Rating-Filter v1;
Outscraper-Tool-UI-Elemente (Unlimited-Toggle, Exact-Match,
Duplicate-Keep, Export-Format-Wahl, API-Request-Drawer, Task-Tags).

## 14. Bewusst NICHT v1 / offen

- **Kein volles zweites Marketing-Site-Ding** — das ist die Spin-out-Phase
  (eigene Subdomain/Brand).
- **Outscraper-Preis** live bestätigen (§6). ✅ erledigt (§12b/13c).
- ~~**Stripe-Wiedereinführung** für Folge-Listen~~ — **GESTRICHEN
  2026-07-12:** Folge-Listen laufen als Abo-Credits (§10), keine
  Web-Zahlung nötig.
- ~~**Email-Enrichment** (`leads_n_contacts`) optional + teurer — später zuschaltbar~~ —
  **ERSETZT 2026-07-15:** laeuft immer, auch Free-Liste, nie als Auswahl (§13d).
- **Raw-CSV bei bezahlten Listen** ist Standard; bei der Gratis-Liste auch (§5).

## 14b. Generator-v3-Runde — Design-Stand 2026-08-05 (VOR Umsetzung)

Jans Optimierungs-Runde vom 2026-08-05, Bearbeitungs-Reihenfolge 1→5.
Status-Legende: ✅ = Jan-entschieden, 🔷 = Claude-Empfehlung, noch nicht
bestätigt. Faktenbasis für alles Location-bezogene: §6b.

1. **„List size" → „Max list size"** (✅): Label + Hint ehrlich machen —
   Limit, keine Garantie („up to"). Quickie.
2. **Mobile-Fix Länder-Pillen** (✅): „Try:"-Chips hängen unter der ganzen
   Country+City-Zeile → beim Mobile-Stacking stehen sie unter City. In die
   Country-Spalte ziehen.
3. **Deutsche Industry-Aliase** (✅ UMGESETZT 2026-08-05): Alias-Asset
   `lib/lists/category-aliases.ts` (locale-scoped `de`, ~340 Aliase über
   alle Kategorien, mehrere pro Kanonik erlaubt) + `searchCategories` in
   `gmb-categories.ts` sucht Kanonik UND Aliase (diakritik-/ß-tolerant,
   Dedupe pro Kanonik: Direkt-Treffer schlägt Alias). Dropdown zeigt
   Alias mit Kanonik als Sublabel (City-Feld-Optik), **Klick setzt die
   englische Kanonik** („Dentist") ins Feld — Markt-Universalität (§6b).
   Häkchen (`isKnownCategory`) bleibt kanonik-only, Freitext (auch
   deutsch) bleibt gültig, Pipeline/API unberührt. Integritäts-Vitest:
   jedes Alias-Ziel muss exakt in `GMB_CATEGORIES` existieren; keine
   Alias/Kanonik-Kollisionen. Dabei ergänzt: Kategorie **„Tax
   consultant"** (fehlte; ist die live-verifizierte GMB-Kategorie für
   Steuerberater). Kommentar in `gmb-categories.ts` auf A/B-Beleg
   präzisiert. Kosten-Hinweis: Server-Filter für en-Märkte bleiben wie
   gehabt; `exactMatch` (en-only, würde Rausch-Records sparen, riskiert
   aber verwandte Kategorien) bewusst GEPARKT — erst A/B-testen, wenn
   Volumen es rechtfertigt.
   **UPDATE Anzeige-Sprache (Jan, 2026-08-05 abends):** Der Klick lässt
   den DEUTSCHEN Text im Feld stehen („Zahnarzt" bleibt sichtbar), die
   Kanonik wird als reine ABLEITUNG aufgelöst
   (`resolveCanonicalCategory`: exakter normalisierter Treffer auf
   Kanonik ODER Alias → englische Kategorie; sonst null = wörtlicher
   Freitext). Bewusst KEIN versteckter Zustand — Text und gesuchte
   Kategorie können nie driften, Häkchen bleibt pur wertabgeleitet.
   Konsequent durch den sichtbaren Pfad: Submit schickt `industry`
   (Kanonik/Query) + `industryDisplay` (Feldtext) →
   `params.industry_display` → BuildingView + Listenname („Zahnarzt –
   Köln") + Lead-Fallback-Branche. Nur Query, query_plan und künftiger
   Coverage-Schlüssel laufen englisch. Test-Invariante: jedes
   Dropdown-Label muss zur value-Kanonik rückauflösbar sein.
   **UI-Endstand „Einrasten" (Design-Variante B, Jan-Wahl aus 3
   Mockups):** Bei erkannter Kategorie kippt das FELD in den
   gerasteten Look (`.lists-snapfield.is-snapped`: Brand-Tönung,
   Text semibold, rechts ✓ + Kanonik; Kanonik entfällt, wenn sie dem
   Feldtext entspricht — kein „Dentist ✓ Dentist"). Flex-Box statt
   absolutem Häkchen (lange Kanonik ellipsiert, keine Kollision).
   Weitertippen löst den Zustand — weiterhin reine Wert-Ableitung.
   Verworfen: A (Single-Chip wie Locations — max. Objekt-Haptik, aber
   Extra-Tap beim Ändern), C (Kanonik-Pille rechts). Multi-Kategorie
   (Outscraper-Muster) bewusst GEPARKT: Credit-Modell erlaubt eh
   mehrere Listen = eine pro Pitch (bessere Call-Ergonomie); bei
   Beta-Nachfrage kleiner Lift (Tag-Input-Pattern + Multi-Query
   existieren, Kreuzprodukt-Cap ~30 + 2D-Round-Robin nötig).
4. **Credit-Modell** (✅ PHASE 1 UMGESETZT + DEPLOYED 2026-08-05):
   - **Entschieden (Jan, 2026-08-05, per MC):** 250 Free-Credits pro
     Account (einmalig); Abo = 500/Monat-**Drip** (auch Jahres-Abo, kein
     Upfront-Topf), Grants **ab Trial-Start**, Stacking-Cap **1.500**
     (bestätigt die §10-Entscheidung, Jans 3.000er-Idee verworfen);
     Kündigung: Listen bleiben, Credits werden am **Perioden-Ende**
     gewiped, Re-Sub startet bei 0. Credits triggern NICHT die Paywall
     (die bleibt der App-First-Call-Gate). 1 Credit = 1 tatsächlich in
     der Liste gelandeter Lead (nach Pipeline-Filter + Dedupe + Cap).
     Weiterhin genau EIN aktiver Job pro Account.
   - **Phase 1 (LIVE):** Migration **0052** (`lead_credits`-Ledger:
     append-only, SUM(delta)=Kontostand, partial-unique-Idempotenz für
     signup_grant/job-Abrechnung; Free-Cap-1-Index ersetzt durch
     Ein-aktiver-Job-Index; Backfill: 24 Bestands-User je +250, 6
     gelieferte Listen rückwirkend verrechnet, alle Konten 85–250).
     `lib/lists/credits.ts` (Konstanten + Clamps + Ledger-Helpers,
     getestet), generate-Route (Lazy-Grant, Balance-Check → 403
     `credits_exhausted`, 409 = `job_running`, `max_size` in params,
     Scan-Limit skaliert mit Wunschgröße), jobs.ts (Slice nach
     max_size, idempotente Abrechnung NACH Ready — Fehlerfall = Liste
     ohne Abrechnung, nie umgekehrt), Status-Route liefert
     `credits {balance, signupTotal}` (nach Self-Heal gelesen).
     UI: Max list size bedienbar (1..min(500, balance), Default
     min(250, balance), Blur-Clamp), Credit-Hint unterm Feld,
     0-Credits-Sperrkarte OHNE Pricing („More credits are coming
     soon"), fertige Listen sperren nichts mehr.
   - **Phase 2 (mit IAP/RevenueCat, NICHT gebaut):** `sub_grant`
     500/Monat am Abo-Jahrestag via RC-Webhook (auch im Trial), Cap
     1.500 beim Grant durchsetzen (Grant = min(500, 1500-balance)),
     `sub_expiry_wipe` am Perioden-Ende, Anti-Churn-Hinweis „Du
     verlierst X Credits" wenn RC auto-renew-off meldet. Kontostand
     prominent ins Dashboard. Reasons sind im 0052-Schema schon
     angelegt.
   - Max list size pro Liste hard-capped auf 500 (realistische
     Liefer-Tiefe einer Einzel-Query) — fällt mit Multi-Location.
5. **Multi-Location-Feld** (✅ UMGESETZT 2026-08-05; Jan-Entscheidungen
   per MC: Cap 5 Chips, Freitext-Enter wird Chip, Label „Locations",
   Coverage-Ledger als FOLGEPAKET):
   - **UI:** `LocationsField` ersetzt das City-Feld — Chips mit X,
     gemischte Vorschläge (lokales Geo-Asset = Regionen mit
     „State"-Sublabel, sofort; Places-Städte debounced dazu), Freitext
     per Enter (zählt immer als Stadt, kein Häkchen), Dedupe pro Chip,
     Landwechsel leert die Chips. **Chip-Design (Jan-Wahl aus 4
     Mockups, 2026-08-05):** ALLE Chips in der Einrast-Optik des
     Industry-Felds (Blau-Tönung + blaue Border), Namen in Ink, nur
     das „STATE"-Wort blau — Formular-Grammatik „blaue Fläche =
     committete Eingabe". Verworfen: neutrale Chips (kollidieren mit
     Try-Pillen), randlose Tokens, Swatch-Dot; auch die Freitext-
     Differenzierung (neutrale Border für nicht-validierte Chips)
     bewusst nicht — Jan wollte den einheitlichen Look.
   - **Geo-Asset** `lib/lists/geo-regions.ts`: kuratierte Top-Städte
     nach Einwohnerzahl für 13 DE-Flächenländer + 8 AT-Bundesländer +
     50 US-States (Stadtstaaten + CH-Kantone bewusst draußen,
     Kommentar erklärt). IDs (`DE-BY`) = künftige Ledger-Schlüssel,
     nie umbenennen. GeoNames-Import-Script erst mit PLZ-Ausbau.
   - **Fan-out** `lib/lists/fanout.ts`: Stadt-Chip = 1 Query (altes
     Format `industry, city`), State-Chip = Top-Städte-Queries
     (`industry, city, state` — Springfield-Präzision, Format wie
     Outscrapers Micro-Queries); Tiefe skaliert mit Region-Zahl
     (1→12, ≤3→8, sonst 5 Städte; Plan ≤ ~25 Queries). Query-Plan
     wird bei Job-Erstellung in `params.query_plan` FIXIERT — die
     Verarbeitung re-derivt nichts (§14b.1-Prinzip).
     `computePerQueryLimit`: ohne Website-Filter eng (×1,4/Queries,
     Floor 15), mit Filter großzügig (×20/Queries — Scans kosten
     nichts, nur Geliefertes).
   - **Ein Request:** alle Queries als EIN Outscraper-Call
     (`dropDuplicates=true` — server-seitiges Dedupe an
     Gebietsgrenzen, sonst doppelt bezahlt).
   - **Fairness:** `orderForDelivery` = Zwei-Ebenen-Round-Robin
     (über Chips, im State über dessen Stadt-Queries; Gruppen via
     `source_query` der Response-Zeilen, in buildLeadRows gestrippt),
     jede Gruppe city-first. Eine Großstadt frisst beim Cap nie die
     Liste.
   - **Bestands-Dedupe:** `filterKnownPhones` gegen ALLE Leads des
     Accounts (Telefon-Schlüssel; Fetch VOR dem Processing-Claim, damit
     Fehler heilbar pending bleiben) — niemand zahlt Credits für
     Dubletten der eigenen Listen. Bleibt auch nach dem Coverage-Ledger
     als Garantie-Netz.
   - API nimmt `locations[{name, regionId?}]` (Fallback altes
     `city`-Feld fürs Deploy-Fenster); Regionen server-validiert
     (Existenz + Land). `params.city` = Anzeige-Join für
     BuildingView/Listen-Name.
   - **Coverage-Ledger** (Design-Baustein, Umsetzung mit diesem Paket oder
     direkt danach): pro Account (Branche, Gebiet, Zeitpunkt, geliefert)
     abhaken; Gebiet GENERISCH typisieren (`city | zip`) — v1 läuft auf
     Stadt-Granularität, PLZ-Tiefenausbau ist späteres Upgrade im selben
     Schema (Detail-Design im Unterabschnitt unten). Wiederholungs-Suchen:
     eigener Ausschluss-Filter gegen vorhandene Leads des Accounts
     (Telefon/place_id) IMMER als Garantie-Netz; `skipPlaces` nur als
     Kosten-Optimierung. Outscraper-seitiges Cross-Task-Filtern existiert
     nicht (§6b).
   - **Geo-Daten-Asset** (Jan-Frage 2026-08-05, Entscheidung: Hybrid):
     Quelle = GeoNames-Dumps (CC-BY, Attribution nötig; `cities1000` +
     Postal-Code-Dumps: DE ~8.200 PLZ, US ~41k ZIP, AU komplett, CA nur
     FSA-3-Zeichen-Gebiete frei — reicht als Tile-Granularität). KEINE
     Runtime-API (Latenz/Rate-Limits/Drift der Ledger-Schlüssel), sondern
     Import-Script → eigene Tabellen (`geo_areas`, `geo_tiles` mit
     Einwohnerzahl für Sortierung), Refresh ~jährlich per Script-Rerun,
     nur additiv (Tile-IDs sind Ledger-Referenzen, nie umbenennen).
     Nebeneffekt: „Top-Städte pro State" für v1-Fan-out fällt gratis aus
     `geo_tiles` (Sort nach Einwohnern) — keine Hand-Kuratierung.

### 14b.1 Ablauf-Design Fan-out + Coverage (erarbeitet 2026-08-05, Beispiel „Dentist, Bayern")

1. **Chip → Tiles:** State-Chip (`DE-BY`) expandiert via `geo_tiles` zu
   geordneten Tiles (Einwohnerdichte absteigend; v1 Stadt-Tiles, später
   PLZ-Tiles ~2.050 für BY). Tile = atomare Query-Einheit.
2. **Coverage-Lookup:** `lead_gen_coverage (user_id, category_canon,
   tile_id, result_count, queried_at, job_id; PK user+cat+tile)` filtert
   schon abgesuchte Tiles raus. `category_canon` = normalisierte
   Kategorie (Alias-Klick → englische Kanonik; Freitext lowercase/trim)
   — „Zahnarzt" und „Dentist" treffen DIESELBE Coverage.
3. **Wellen:** pro Welle ~25 offene Tiles als EIN Outscraper-Request
   (Multi-Query, `dropDuplicates`, kleines per-Query-Limit), Request-ID
   je Welle in `lead_gen_job_tiles (job_id, tile_id, wave,
   outscraper_request_id, status)`. Webhook-Handler verarbeitet UND
   stößt die nächste Welle an (Event-Kette, kein Langläufer — passt zu
   Vercel); bestehender Status-Poll heilt verlorene Webhooks pro Welle.
   Stop: Ziel erreicht / Tiles leer / Welle liefert ~nichts /
   Sicherheits-Cap (Wellen+Kosten).
4. **Abhaken bei EMPFANG, nie beim Senden** (Kern-Invariante):
   Coverage-Upsert erst wenn Ergebnisse da (Zeilen→Tile-Zuordnung über
   die `query`-Spalte der Response, live verifiziert). `result_count: 0`
   wird AUCH abgehakt (bezahlte Erkenntnis „hier ist nichts").
   Crash zwischen Senden+Empfang ⇒ Tile bleibt offen ⇒ Folge-Lauf sucht
   erneut — Fehlerfall kostet Cents, Coverage lügt NIE.
5. **Cap + Spillover:** Round-Robin über Städte beim Füllen bis
   max_list_size/Credits. Überschüssige valide Leads aus ABGEHAKTEN
   Tiles gehen in `lead_gen_spillover (user, category_canon, tile_id,
   lead_data jsonb)` — sonst wären sie für den User für immer verloren
   (Tile wird ja übersprungen). Folge-Lauf gleicher Kategorie leert
   Spillover ZUERST (0 Outscraper-Kosten, zählt nur gegen Credits).
6. **Wiederholungslauf:** Spillover → dann Wellen ab erstem offenen
   Tile. UI kann ehrlich fortschreiben („last list covered Munich &
   Nuremberg — continuing with Augsburg"). Alles abgehakt ⇒ klare
   Ansage statt Leer-Liste; Coverage-TTL/Refresh (z. B. 12 Mon. via
   `queried_at`) = spätere Produktentscheidung, Schema kann es ab Tag 1.

Stabilitäts-Prinzipien: Tile-IDs nur aus dem versionierten Geo-Snapshot
(nie aus Live-APIs → kein Ledger-Drift); Idempotenz auf jeder Stufe
(Upserts, Request-IDs, Poll-Heilung); konservatives Abhaken; „ein Job
gleichzeitig pro Account" (Jan-Regel) eliminiert Coverage-Races; v1
Stadt-Tiles und PLZ-Ausbau teilen Schema + Pipeline.

## 15. Verweise

- Pricing/Paywall-Kette: Memory `project_pricing_strategy`, App-Repo
  `specs/paywall-first-call-gate.md`.
- Auth-aware Landing + `SignupForm`: Memory `project_callday_web_auth_aware_landing`,
  `project_landing_light_redesign`.
- Outscraper: OpenAPI v0.4.3 (lokale Datei / `docs.outscraper.com`), offizielle
  Node-SDK (`npm i outscraper`).
- Sync/Tenant: Memory `feedback_local_db_single_tenant`.
