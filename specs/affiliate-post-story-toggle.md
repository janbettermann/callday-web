# Add-a-post: Post/Story-Toggle — Spec

> Status: **Idee bestätigt (2026-07-08), noch nicht implementiert.** Kleine
> Erweiterung des Affiliate-Post-Loggings im „Add a post"-Slide-up.

## 1. Was

Über dem Link-Feld im „Add a post"-Slide-up ein Toggle **Post / Story**:
- **Post** (Default) — Verhalten wie bisher, Link ist Pflicht.
- **Story** — Link ist **optional** (eine Story hat oft keinen pastebaren
  Permalink und verfällt nach 24 h).

## 2. Warum es sauber ist (der tragende Punkt)

Die Post-Stats („X visitors / X sign-ups in the 48 h after") laufen **rein über
`posted_at`** + das Zeitfenster (`computePostStats` in
`lib/affiliate-activity.ts`) — der Link-URL wird für die Auswertung **nicht**
benutzt, er ist nur Anzeige/Referenz. Eine Story ohne Link bekommt also die
volle Korrelation; der Zeitstempel trägt die ganze Aussage. „Link optional bei
Story" bricht damit nichts.

Nutzen: (a) **Reibung raus** — Stories sind wegen `url NOT NULL` aktuell quasi
nicht loggbar, ohne etwas Sinnloses reinzukopieren; (b) **besseres Signal** —
Story (scharfer Spike, solange live) vs Post (langer Schwanz über Tage) sind
analytisch unterschiedlich. Der Toggle kodiert im Grunde die Achse „permanenter
Link vs ephemer" — genau die entscheidet, ob ein Link Pflicht ist.

## 3. Schema — Migration 0042 (dealswipe-app)

`affiliate_posts` (0039) additiv erweitern:

```sql
alter table public.affiliate_posts
  add column if not exists type text not null default 'post'
    check (type in ('post','story')),
  alter column url drop not null;
```

- Additiv + **non-destruktiv**: kein Drop, kein Datenverlust — `drop not null`
  lockert nur die Constraint. Auf geteilter Prod unbedenklich.
- Bestehende Rows: `type='post'` (Default), `url` bleibt gesetzt.
- Manueller SQL-Editor-Deploy (Memory `reference_supabase_migrations`).

## 4. UI + Server (callday-web)

- **`app/affiliate/dashboard/AddPostForm.tsx`:** Toggle (Post/Story) über dem
  „Post link"-Feld. State steuert:
  - `type` wird mitgesendet.
  - Bei `story`: Link-Input **nicht** `required`, Label → „Post link
    (optional)". Leerer Link → `url = null`.
- **`app/affiliate/dashboard/actions.ts` (`addAffiliatePostAction`):** `type`
  annehmen + validieren (`post|story`), `url` bei leer/story auf `null` erlauben
  (bei `post` weiter Pflicht).
- **`app/affiliate/PostList.tsx`:** kleines Typ-Tag „Story" neben dem
  Plattform-Pill (Post = Default, kein Tag oder eigenes). Die Link-Zeile
  (`<a href={post.url}>`) nur rendern, wenn `url` gesetzt ist — linklose Story =
  nur Pill + Zeit + Stat-Box.
- **`lib/affiliate-activity.ts`:** `PostRow`-Type um `type` erweitern, `url`
  nullable; `type` in der Select-Query mitlesen.
- **Linklose Story „was war das":** das bestehende `note`-Feld (schon in
  `affiliate_posts` + Query) kann das tragen — ggf. als optionales Notizfeld im
  Formular exponieren.

## 5. Korrelationsfenster

Für v1 **uniform bei 48 h** (`POST_WINDOW_HOURS`) für beide Typen — einfach,
kein Sonderpfad.

Spätere Verfeinerung (dokumentiert, **nicht v1**): Story ist ~24 h live → eigenes
24-h-Fenster für `story`, 48 h für `post`. Erst wenn die Daten zeigen, dass sich
der Sonderfall lohnt.

## 6. Datei-Touch-Liste

| Teil | Repo | Pfad |
|---|---|---|
| Migration 0042 (`type` + `url` nullable) | dealswipe-app | `supabase/migrations/` |
| Formular-Toggle + Link-optional | callday-web | `app/affiliate/dashboard/AddPostForm.tsx` |
| Server-Action (`type` + `url` null) | callday-web | `app/affiliate/dashboard/actions.ts` |
| Typ-Tag + Link-Guard | callday-web | `app/affiliate/PostList.tsx` |
| `PostRow`-Type + Query | callday-web | `lib/affiliate-activity.ts` |

## 7. Bewusst nicht / offen

- **Kein weiterer Typ** als Post/Story. Reels/Shorts sind permanent + haben
  Links → zählen als „Post". Binär reicht: permanent vs ephemer.
- **24-h-Story-Fenster** deferred (§5).
- **Note-Feld im Formular** exponieren: optional, kann auch später kommen.
- Nicht jede Plattform hat Stories (X z.B. nicht) — kein Blocker, der Affiliate
  wählt einfach was passt.
