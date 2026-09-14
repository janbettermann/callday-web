# Landing-Page-Experimente (Split-Tests mit Meta Ads)

Stand 2026-09-14. Infrastruktur fuer saubere A/B-Tests auf der Landing Page
(`/`), gedacht fuer den Start der Meta-Ads mit 10 EUR Tagesbudget. Alles
first-party: kein Cookie, kein Drittanbieter-Script, Daten liegen in
Supabase neben den Sign-ups.

## Wie es funktioniert

1. **Eine URL fuer alle.** Die Anzeige zeigt auf `callday.io/?utm_source=meta&…`.
   Meta weiss nichts von Varianten und braucht pro Test nichts Neues.
2. **Zuweisung beim Server-Render** (`lib/lp/server.ts`): aus IP, User-Agent
   und einem Server-Salt entsteht ein Visitor-Hash, daraus pro Experiment ein
   Bucket. Derselbe Besucher sieht ueber die Testdauer dieselbe Variante,
   ohne Cookie. Google-Besucher und Direktzugriffe werden genauso zugeteilt
   und in der Auswertung nach Quelle getrennt.
3. **Rendering** der Varianten liegt in `app/page.tsx` — ein `if` auf
   `assignment.variant`. Nach dem Test wird der Gewinner zum Default und der
   Zweig geloescht.
4. **Events** in `lp_events` (Migration `0058_lp_events.sql` im App-Repo):
   - `view`, `cta_click` (hero/nav), `signup_started` (apple/google/email)
     schickt der Client an `POST /api/lp-event`.
   - `signup_confirmed` schreibt der Server nach echter Bestaetigung
     (OTP: `/api/app-download-mail`, OAuth: `/auth/callback`). Der Landing-
     Kontext reist als `user_metadata.lp` bzw. Cookie `lp_ctx` (5 Minuten)
     mit — dasselbe Muster wie die Affiliate-Attribution.
5. **Auswertung** unter `/[secret]/experiments`: Funnel nach Quelle und
   Geraet, Varianten-Vergleich mit Stichproben-Fortschritt, P(besser) und
   p-Wert, letzte Sign-ups mit Herkunft.
6. **Meta Conversions API** (`lib/lp/meta-capi.ts`): server-seitig `Lead`
   bei signup_started und `CompleteRegistration` bei signup_confirmed,
   damit Meta auf Registrierungen optimieren kann. Nur wenn die Env-Vars
   gesetzt sind, und nie fuer EU/EWR/UK/CH-Besucher (Vercel-Laender-Header).

## Einrichtung (einmalig)

**Migration anwenden** — im App-Repo (`C:\Dev\callday-app`):

```bash
supabase db push
```

oder den Inhalt von `supabase/migrations/0058_lp_events.sql` im Supabase-
SQL-Editor ausfuehren. Ohne die Tabelle zeigt die Admin-Seite einen Hinweis;
die Landing funktioniert trotzdem (Inserts scheitern leise).

**Env-Vars** (Vercel + Doppler):

| Variable | Pflicht | Zweck |
|---|---|---|
| `LP_VISITOR_SALT` | ja, in Production | Server-Geheimnis fuer den Visitor-Hash. Beliebiger langer Zufallsstring. Ein Wechsel mischt laufende Tests neu, also waehrend eines Tests nicht anfassen. |
| `META_PIXEL_ID` | nein | Pixel-/Dataset-ID aus dem Events Manager. Ohne sie wird CAPI uebersprungen. |
| `META_CAPI_TOKEN` | nein | System-User-Token mit `ads_management` fuer die Conversions API. |
| `META_CAPI_TEST_CODE` | nein | Test-Event-Code aus dem Events Manager, nur waehrend der Einrichtung setzen. |
| `META_GRAPH_VERSION` | nein | Graph-API-Version, Default `v23.0`. Im Events Manager pruefen, welche aktuell ist. |

**Ad-URL** in Meta, mit dynamischen Parametern, damit Kampagne und Anzeige in
der Auswertung auftauchen:

```
https://callday.io/?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

Keine `v=`-Parameter in Ad-URLs — das waere eine feste Zuweisung, und
solche Aufrufe werden nicht getrackt.

## Vorschau der Varianten

- `localhost:3000/?v=a` bzw. `callday.io/?v=b` zeigt die Variante fest an.
- Aufrufe mit `v=` senden keine Events (eigene QA-Klicks landen nicht in
  der Auswertung).
- Ohne Parameter siehst du, was ein zufaelliger Besucher sieht. Auf dem
  iPhone im Instagram-Browser pruefen — dort landet fast aller Ad-Traffic.

## Workflow pro Test

1. **Baseline kennen.** Die ersten ein bis zwei Wochen Ads ohne Test laufen
   lassen und im Admin die Raten ablesen (CTA, gestartet, bestaetigt).
   Ohne Basisrate laesst sich kein Test dimensionieren.
2. **Hypothese** in einem Satz: was aendert sich, warum sollte es wirken,
   welche Metrik entscheidet. Eine Variable pro Test. Grosse Schwuenge
   zuerst (Headline, Angebot, Aufbau), Kosmetik zuletzt.
3. **Stichprobe** aus Basisrate und gesuchtem Effekt (Tabelle unten). Bei
   wenig Traffic auf `signup_started` entscheiden und `signup_confirmed` als
   Leitplanke mitlesen.
4. **Eintragen** in `lib/lp/experiments.ts` (`ACTIVE_EXPERIMENT`), Variante
   in `app/page.tsx` verzweigen, per `?v=` auf dem iPhone pruefen, deployen.
   Eintrag ins Logbuch unten, mit Startdatum.
5. **Laufen lassen.** Anzeigen waehrend des Tests nicht aendern (Message
   Match). Nicht bei "sieht signifikant aus" abbrechen — der Fortschritts-
   balken im Admin sagt, wann die Stichprobe voll ist.
6. **Auswerten** auf dem Meta-Segment (Quelle = Meta Ads), Mobile separat.
   P(besser) ueber 95 Prozent oder p-Wert unter 0,05 bei voller Stichprobe
   = Gewinner. Alles andere = kein Unterschied nachweisbar, Kontrolle bleibt.
7. **Abschliessen**: Gewinner als Default in `page.tsx`, `ACTIVE_EXPERIMENT`
   auf `null`, Zweig loeschen, Ergebnis ins Logbuch.

## Stichproben-Tabelle (pro Variante, zweiseitig, 95 % / 80 % Power)

| Entscheidungsmetrik | Basisrate | Gesuchter Effekt | Besucher pro Variante |
|---|---|---|---|
| Sign-up bestaetigt | 3 % | +20 % relativ | ~14.000 |
| Sign-up bestaetigt | 3 % | +50 % relativ | ~2.500 |
| Sign-up gestartet | 12 % | +20 % relativ | ~3.100 |
| Sign-up gestartet | 12 % | +35 % relativ | ~1.100 |
| CTA-Klick | 20 % | +25 % relativ | ~900 |

Der Admin rechnet die Zahl fuer das aktive Experiment aus `baselineRate`
und `relativeMde` selbst aus (`lib/lp/stats.ts`).

## Bekannte Grenzen

- **Visitor-Hash statt Cookie.** Hinter Carrier-NAT teilen sich viele Handys
  eine IP, iPhones im Instagram-Browser haben nahezu identische User-Agents.
  Solche Besucher fallen zusammen (gleiche Variante, ein "Unique"). Fuer
  Ad-Traffic, der in derselben Session konvertiert, verzerrt das den
  Vergleich nicht; die absoluten Besucherzahlen sind eher zu niedrig.
- **Netzwechsel** (WLAN → Mobilfunk am naechsten Tag) kann die Variante
  wechseln. Selten relevant, weil Conversions fast immer in der ersten
  Session passieren.
- **Kein Sequenzial-Test.** Stichprobe vorher festlegen, durchlaufen lassen.
- **Ein Test zur Zeit**, nur auf `/`. Affiliate-Landings (`/a/[slug]`) werden
  im Funnel mitgezaehlt (Filter im Admin), bekommen aber keine Varianten.

## Logbuch

| Start | Ende | Key | Hypothese | Metrik | Ergebnis | Entscheidung |
|---|---|---|---|---|---|---|
| 2026-09-14 | – | – | Infrastruktur live, kein Test. Baseline-Phase mit dem Start der Meta-Ads. | – | – | – |
