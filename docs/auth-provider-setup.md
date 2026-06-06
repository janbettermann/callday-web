# Auth-Provider-Setup (Apple + Google)

Wie callday.io's Sign-in-with-Apple + Sign-in-with-Google ueber Supabase aufgesetzt sind. Lebende Doku — bei Re-Setup, Provider-Rotation, oder zweite Person diese Datei lesen.

Hinweis: das Mobile-Repo hat ein eigenes Setup mit nativen Flows (`expo-apple-authentication`, `@react-native-google-signin/google-signin`). Diese Doku ist nur fuer den Web-OAuth-Pfad ueber callday.io.

## Konventionen

- **Supabase Project-Ref:** `amqdddjsafdxgfprehgc` (Stand 2026-06)
- **Supabase OAuth-Callback:** `https://amqdddjsafdxgfprehgc.supabase.co/auth/v1/callback`
- **Unser App-Callback:** `https://callday.io/auth/callback` (PKCE-Exchange)
- **Apple Team ID:** `2Z6729643N`
- **Apple Services ID:** `io.callday.web.auth`
- **Apple Key ID:** `2X352D2J4H`

## Google Sign-In

### 1. Google Cloud Console — OAuth-Client erstellen

Projekt: das bestehende **Dealswipe**-Projekt (gleicher Provider den die Mobile-App fuer Google Sign-In + Gmail-Connect nutzt).

1. https://console.cloud.google.com → Dealswipe-Projekt
2. **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**
3. **Application type:** `Web application`
4. **Name:** `Callday Web (Supabase)`
5. **Authorized JavaScript origins:**
   - `https://callday.io`
   - `https://www.callday.io`
   - `http://localhost:3000`
6. **Authorized redirect URIs:**
   - `https://amqdddjsafdxgfprehgc.supabase.co/auth/v1/callback`
7. **CREATE** → Client ID + Client Secret notieren (Secret nur jetzt sichtbar)

### 2. Supabase — Google-Provider aktivieren

1. https://supabase.com/dashboard → Callday-Projekt → **Authentication → Sign In / Providers → Google**
2. **Enable Sign in with Google: ON**
3. **Client IDs** (comma-separated): **die neue Web-OAuth-Client-ID als ERSTEN Eintrag**, dann die bestehenden Mobile-Audience-IDs (siehe Memory `supabase-oauth-provider-client-id-order`)
4. **Client Secret (for OAuth):** das in Schritt 1.7 notierte Secret
5. **Skip nonce checks: ON** (wegen iOS-Mobile-Flow, beeintraechtigt Web-OAuth nicht)
6. **Save**

### 3. Test

Inkognito → https://callday.io/login → **Continue with Google** → muss durchklicken.

### Wichtig vor Public-Launch

OAuth-App ist aktuell in **Testing-Status** in Google Cloud Console. Nur Testnutzer auf der OAuth-Consent-Screen-Liste koennen sich einloggen. Vor Public-Launch:

- OAuth-Consent-Screen vollstaendig ausfuellen (App-Logo, Privacy-URL, Terms-URL, Authorized Domains, Developer-Contact)
- **Publish App** klicken → "In production"-Status

(Separat von Gmail-API-Verification fuer den `gmail.send`-Scope — siehe Memory `gmail-oauth-verification-fehlt`. Sign-in mit OpenID-Scopes braucht keine Google-Verification, ist non-sensitive.)

## Apple Sign-In

### 1. Apple Developer Portal — Services ID + Key

#### Services ID

1. https://developer.apple.com/account → **Certificates, IDs & Profiles → Identifiers**
2. Filter im Dropdown oben rechts auf **Services IDs** stellen (default ist App IDs)
3. **+ Plus** → **Services IDs → Continue**
4. **Description:** `Callday Web Auth`
5. **Identifier:** `io.callday.web.auth`
6. **Register**
7. Den neuen Eintrag oeffnen → **Sign in with Apple** anhaken → **Configure:**
   - **Primary App ID:** `com.dealswipe.app` (die Mobile-App-ID)
   - **Domains and Subdomains:** `amqdddjsafdxgfprehgc.supabase.co`
   - **Return URLs:** `https://amqdddjsafdxgfprehgc.supabase.co/auth/v1/callback`
8. **Save**

#### Key

1. Linkes Menü **Keys → + Plus**
2. **Key Name:** `Callday Apple SignIn Key` (ohne Bindestrich, Apple meckert sonst)
3. **Sign in with Apple** anhaken → **Configure** → **Primary App ID = com.dealswipe.app** → **Save**
4. **Continue → Register**
5. **Download** der `.p8`-Datei (nur EINMAL moeglich) — sicher abspeichern
6. Key ID + Team ID notieren

### 2. Client-Secret JWT generieren

Apple's "Client Secret" ist ein selbst-signed JWT mit max 6 Monaten Laufzeit. Script generiert ihn:

```bash
node scripts/generate-apple-client-secret.js <pfad-zur-AuthKey_2X352D2J4H.p8>
```

Output: `eyJ...`-String + Metadata.

**Renewal-Pflicht:** alle ~5 Monate erneut ausfuehren. Siehe Memory `apple-client-secret-jwt-renewal`.

### 3. Supabase — Apple-Provider aktivieren

1. Authentication → Sign In / Providers → **Apple**
2. **Enable Sign in with Apple: ON**
3. **Client IDs** (comma-separated): **Services ID als ERSTEN Eintrag**, dann Mobile-Bundle-ID:
   ```
   io.callday.web.auth,com.dealswipe.app
   ```
4. **Secret Key (for OAuth):** den JWT-String aus Schritt 2 einfuegen
5. **Save**

### 4. Test

Inkognito → https://callday.io/login → **Continue with Apple** → muss durchklicken.

Bei "Hide my email": Supabase erstellt einen User mit `*.privaterelay.appleid.com`-Adresse. Bei "Share my email": Supabase findet existing User mit gleicher verifizierter Email + linkt Apple-Identity dran.

## Multi-Provider-Verhalten

**Auto-Linking by verified Email** ist Supabase-Default — wenn ein User mit Email/PW existiert und sich mit Google (gleiche Email, verified) einloggt, wird Google an den existing User gelinkt. `user.identities[]` zeigt alle verknuepften Provider, `/account` rendert sie.

Apple-mit-Hide-Email matched nichts → separater Account. User-Wahl ist pro App+Apple-ID dauerhaft, revertable ueber Apple-Settings → "Stop using Sign in with Apple".

## Troubleshooting

| Symptom | Vermutliche Ursache |
|---|---|
| `Unable to exchange external code` nach Google-Sign-in | Client-IDs-Reihenfolge in Supabase falsch — Web-OAuth-ID muss zuerst sein |
| Sign-in-with-Apple wortlos nicht mehr (Web only) | JWT abgelaufen, renewn via Script |
| `redirect_uri_mismatch` von Google | Authorized Redirect-URI in Google Cloud Console pruefen — muss `https://<project>.supabase.co/auth/v1/callback` enthalten |
| Apple-Dialog kommt aber bricht ab | Domain in Apple Service-ID-Konfig nicht aktuelle Supabase-Domain — bei Project-Wechsel updaten |
| `?error=access_denied` | User hat Apple/Google-Dialog abgebrochen — kein Bug |
| Provider-Konflikt-Fehler "Identity already exists" | Edge-Case: OAuth-Provider gibt Email als unverified zurueck → kein Auto-Link. User soll andere Methode probieren |

## Verwandte Dokumente

- `scripts/generate-apple-client-secret.js` — JWT-Generator + Renewal-Doku im Header
- `app/login/page.tsx` — Frontend-Code (signInWithOAuth-Aufrufe)
- `app/auth/callback/route.ts` — PKCE-Exchange + Error-Handling
- `middleware.ts` — Cookie-Refresh fuer SSR-Auth
