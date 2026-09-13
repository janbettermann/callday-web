"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CountryAutocomplete } from "../CountryAutocomplete";
import { GeneratorFeedback } from "../GeneratorFeedback";
import { IndustryAutocomplete } from "../IndustryAutocomplete";
import { InfoPopover } from "../InfoPopover";
import { LocationsField, type LocationChip } from "../LocationsField";
import {
  failureMessage,
  fetchJobStatus,
  type StatusResponse,
} from "../job-view";
import { CalldayMark } from "@/app/components/ListCardActions";
import {
  APP_DOWNLOAD_PATH,
  INDUSTRY_SUGGESTIONS,
} from "@/lib/lists/config";
import {
  DEFAULT_LIST_SIZE,
  MAX_LIST_SIZE,
} from "@/lib/lists/credits";
import { resolveCanonicalCategory } from "@/lib/lists/gmb-categories";
import type { WebsiteFilterMode } from "@/lib/lists/pipeline";

/**
 * Generator-Konsole auf /lists/new — EIN Formular als Card, keine
 * Live-Summary, kein How-it-works-Strip mehr (Jan-Design-Entscheidung
 * 2026-07-15: Mobile-first, das Panel saesse dort eh unterm Formular;
 * eleganter loesen wenn Credits/Enricher-Zeilen wirklich kommen).
 *
 * /lists/new ist DIE eine Generator-URL (Jan-Entscheidung 2026-07-14) —
 * die fertige Free-Liste hat hier keine eigene Ansicht mehr, sie wohnt
 * auf /lists. Zustaende aus /api/lists/status (geteilte View-Typen in
 * ../job-view): kein Job/failed/ready → Form (failed mit Banner),
 * pending/processing → Form gesperrt + Hinweis "wird gebaut" mit Link
 * zur Liste, 0 Credits → Form gesperrt + Hinweis warum.
 *
 * Kein Zwischenscreen mehr (Jan 2026-09-13): ein erfolgreich gestarteter
 * Job schickt sofort nach /lists, wo die Building-Kachel den Lauf zeigt
 * — der Payoff ist die Liste, und sie erscheint genau dort. Die fruehere
 * Building-Ansicht mit vier Pipeline-Stufen war nicht ehrlich (Backend
 * kennt nur pending/processing und pendelt bei Nachschlag-Wellen und
 * E-Mail-Suche zurueck), Git-History als Referenz.
 */

const POLL_INTERVAL_MS = 5000;

// Segmented-Control-Optionen (Jan 2026-08-05). Kurze Labels fuers
// Segment, der Subtitle darunter formuliert den Modus aus (immer
// sichtbar, auch bei "All"). "All" ist bewusst kurz — das Segment
// schrumpft auf seine Breite, No/Has website kriegen den Rest (CSS
// :first-child).
const WEBSITE_FILTER_OPTIONS: Array<{
  value: WebsiteFilterMode;
  label: string;
  subtitle: string;
}> = [
  {
    value: "any",
    label: "All",
    subtitle: "Businesses with and without a website",
  },
  {
    value: "without",
    label: "No website",
    subtitle: "Only businesses without a website",
  },
  {
    value: "with",
    label: "Has website",
    subtitle: "Only businesses with a website",
  },
];

export function GeneratorClient() {
  const router = useRouter();
  const [statusData, setStatusData] = useState<
    StatusResponse | null | undefined
  >(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [industry, setIndustry] = useState("");
  const [locations, setLocations] = useState<LocationChip[]>([]);
  const [country, setCountry] = useState<string | null>("DE");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilterMode>("any");
  const [maxSize, setMaxSize] = useState(String(DEFAULT_LIST_SIZE));
  // Solange der User das Feld nicht angefasst hat, folgt es dem
  // Kontostand (min(250, balance)) — danach gewinnt seine Eingabe.
  const maxSizeEditedRef = useRef(false);

  // Preset aus Affiliate-/Funnel-Links (?website=without) — reist durch
  // Signup + Login-Redirect bis hierher.
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("website");
    if (preset === "without" || preset === "with") {
      setWebsiteFilter(preset);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchJobStatus()
      .then((data) => active && setStatusData(data))
      .catch(() => active && setStatusData(null));
    return () => {
      active = false;
    };
  }, []);

  const job = statusData?.job ?? null;
  const credits = statusData?.credits ?? null;
  const jobRunning =
    job !== null && (job.status === "pending" || job.status === "processing");

  // Credit-Modell (Phase 1): gesperrt wird erst bei 0 Credits — fertige
  // Listen sperren nichts mehr, es darf nachgelegt werden, bis das
  // Konto leer ist. Das Formular bleibt sichtbar (eine URL, ein Ort),
  // im 0-Zustand ausgegraut mit Hinweis.
  const creditsExhausted = credits !== null && credits.balance < 1;

  // Max-size-Vorbelegung folgt dem Kontostand, solange unangetastet.
  useEffect(() => {
    if (credits && credits.balance > 0 && !maxSizeEditedRef.current) {
      setMaxSize(String(Math.min(DEFAULT_LIST_SIZE, credits.balance)));
    }
  }, [credits]);

  // Landwechsel leert die Location-Chips: Regionen gehoeren fest zum
  // Land, und auch Stadt-Chips waeren im neuen Land falsche Queries.
  const prevCountryRef = useRef(country);
  useEffect(() => {
    if (prevCountryRef.current !== country) {
      prevCountryRef.current = country;
      setLocations([]);
    }
  }, [country]);

  // Revisit waehrend eines Laufs (User klickt "Generate list", waehrend
  // auf /lists gebaut wird): weiter pollen, damit das Formular aufgeht,
  // sobald der Job durch ist — und weil der Poll den Self-Heal treibt,
  // solange niemand die Building-Kachel auf /lists offen hat.
  useEffect(() => {
    if (!jobRunning || !job) return;
    const timer = setInterval(() => {
      fetchJobStatus(job.id)
        .then(setStatusData)
        .catch(() => {
          // Poll-Fehler still schlucken — der Job laeuft server-seitig
          // weiter, der naechste Tick versucht es erneut.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobRunning, job]);

  const handleGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // Guard ist Gurt zur Hose: server-seitig erzwingen Kontostand
      // (403) und der Ein-aktiver-Job-Index (409) die Regeln ohnehin.
      if (submitting || creditsExhausted || jobRunning) return;
      setFormError(null);

      if (!industry.trim() || locations.length === 0) {
        setFormError(
          "Add an industry and at least one location — that's all we need.",
        );
        return;
      }
      if (!country) {
        setFormError("Pick a country from the suggestions.");
        return;
      }

      setSubmitting(true);
      // Bei Navigation nach /lists bleibt submitting true, damit der
      // Button nicht kurz wieder klickbar wird, bevor die Seite wechselt.
      let navigating = false;
      try {
        const response = await fetch("/api/lists/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Query-Begriff = Kanonik (falls aufloesbar), Anzeige =
            // Feldtext ("Zahnarzt" bleibt sichtbar, gesucht wird
            // "Dentist" — §14b Punkt 3, Anzeige-Sprache-Split).
            industry: resolveCanonicalCategory(industry) ?? industry,
            industryDisplay: industry,
            locations: locations.map((chip) => ({
              name: chip.name,
              regionId: chip.regionId,
              // Places-ID → Stadt-zu-PLZ-Aufloesung am Server (Tiling).
              placeId: chip.placeId,
            })),
            country,
            website: websiteFilter,
            maxSize: Number.parseInt(maxSize, 10) || DEFAULT_LIST_SIZE,
          }),
        });

        if (response.status === 409) {
          // Es laeuft schon eine Generierung (Race/Doppel-Tab) — die
          // Building-Kachel auf /lists zeigt sie.
          navigating = true;
          router.push("/lists");
          return;
        }
        if (response.status === 403) {
          // Konto leer (Race mit anderem Tab) — Status bringt die
          // 0-Credits-Sperre mit.
          setStatusData(await fetchJobStatus());
          setFormError("You've used all your free lead credits.");
          return;
        }
        if (response.status === 422) {
          // Alles abgedeckt (Coverage-Ledger): der Server formuliert die
          // Ansage ("You've already covered all of Köln for Dentist …").
          const body = (await response.json()) as { message?: string };
          setFormError(
            body.message ??
              "You've already covered that area for this industry. Try a nearby city or another industry.",
          );
          return;
        }
        if (!response.ok) {
          setFormError(
            response.status === 400
              ? "That search doesn't look right — check industry and city."
              : "The generator is unavailable right now. Please try again in a few minutes.",
          );
          return;
        }

        // Gestartet — ab hier lebt der Lauf auf /lists (Building-Kachel).
        navigating = true;
        router.push("/lists");
      } catch {
        setFormError("Network hiccup — please try again.");
      } finally {
        if (!navigating) setSubmitting(false);
      }
    },
    [
      router,
      submitting,
      creditsExhausted,
      jobRunning,
      industry,
      locations,
      country,
      websiteFilter,
      maxSize,
    ],
  );

  if (statusData === undefined) {
    return <p className="lists-loading">Loading…</p>;
  }

  const formLocked = creditsExhausted || jobRunning;
  const formDisabled = submitting || formLocked;

  return (
    <div className="lists-inner-account">
      {job?.status === "failed" && (
        <p className="beta-submit-error lists-fail-banner" role="alert">
          {failureMessage(job)}
        </p>
      )}

      {/* Laufender Job (Revisit): das Formular ist wegen der Ein-aktiver-
          Job-Regel gesperrt — sagen warum, und zur Kachel zeigen. Hat
          Vorrang vor dem Credits-Hinweis (waehrend eines Laufs sind die
          Credits noch nicht abgerechnet). */}
      {jobRunning && job && (
        <div className="lists-locked-note" role="status">
          <div>
            <p className="lists-locked-title">
              {job.listName ?? "Your list"} is being built…
            </p>
            <p className="lists-locked-body">
              Usually under a minute — we&apos;ll email you when it&apos;s
              ready. You can start the next list as soon as this one is
              done.
            </p>
          </div>
          <Link
            href="/lists"
            className="account-btn account-btn-primary lists-locked-btn"
          >
            See your lists
          </Link>
        </div>
      )}

      {/* 0-Credits-Zustand = haeufigster Endpunkt des Generators (jede volle
          250er-Liste landet hier) und der Moment, in dem der Free-User zur
          App soll: CTA = derselbe App-Pfad wie "Open in Callday" auf den
          Listen-Kacheln. Bewusst kein Pricing-/Abo-Satz — die Abo-Credits
          sind Phase 2 (noch nicht gebaut); nichts versprechen, was der Code
          nicht haelt. */}
      {creditsExhausted && !jobRunning && (
        <div className="lists-locked-note" role="status">
          <div>
            <p className="lists-locked-title">
              Your {credits?.signupTotal} free credits are used up — your
              leads are ready to call.
            </p>
            <p className="lists-locked-body">
              Every lead we delivered used one credit. Open them in the
              Callday app and start dialing.
            </p>
          </div>
          <Link
            href={APP_DOWNLOAD_PATH}
            className="account-btn account-btn-primary lists-locked-btn"
          >
            <CalldayMark />
            Open in Callday
          </Link>
        </div>
      )}

      <div className={"lists-console" + (formLocked ? " is-locked" : "")}>
        <form className="beta-form lists-console-form" onSubmit={handleGenerate} noValidate>
          {/* Titel lebt IN der Card (Jan-Wahl 2026-08-06, Variante A ohne
              Trennlinie) — der Generator wirkt als geschlossenes Tool in
              einer Flaeche. Der Brand-Moment (pulsierender Sun-Gold-Punkt)
              sitzt im Titel. "New"-Pille + Feedback-Zeile (Jan 2026-09-11):
              der GENERATOR ist das neue Feature, nicht die App in Beta —
              Erwartung senken, Feedback einladen. */}
          <header className="lists-cardhead">
            <div className="lists-worktitle-row">
              <span className="lists-live-dot" aria-hidden="true" />
              <h1 className="lists-cardtitle">Call list Generator</h1>
              <span className="lists-new-pill">New</span>
            </div>
            <p className="lists-worksub">
              Scan Google Maps for your ideal customers.
            </p>
            <GeneratorFeedback />
          </header>

          <IndustryAutocomplete
            value={industry}
            disabled={formDisabled}
            onChange={setIndustry}
            suggestions={INDUSTRY_SUGGESTIONS}
            required
          />

          {/* Country + Locations in einer Zeile (Desktop nebeneinander,
              schmal untereinander — Country zuerst per Source-Order). */}
          <div className="beta-field">
            <div className="lists-field-row">
              <div className="lists-col-country">
                <CountryAutocomplete
                  code={country}
                  disabled={formDisabled}
                  onChange={setCountry}
                  required
                />
              </div>
              <div className="lists-col-city">
                <LocationsField
                  chips={locations}
                  country={country}
                  disabled={formDisabled}
                  onChange={setLocations}
                  required
                />
              </div>
            </div>
          </div>

          {/* Max-Listengroesse — seit dem Credit-Modell bedienbar,
              gedeckelt auf Rest-Credits (Server klammert nochmal).
              "Max" + Hint machen ehrlich, dass das ein Limit ist, keine
              Garantie: kleine Suchen liefern kleinere Listen, und nur
              gelieferte Leads kosten Credits (Spec §14b Punkt 4). */}
          <div className="beta-field">
            <div className="lists-label-row">
              <label className="beta-field-label" htmlFor="gen-listsize">
                Max list size
              </label>
              <InfoPopover label="About max list size">
                Your list can come out smaller than this if your search does
                not find enough businesses. Credits are only used for leads
                that actually land in your list.
              </InfoPopover>
            </div>
            <div className="lists-size-row">
              <input
                id="gen-listsize"
                className="lists-size-input"
                type="text"
                value={maxSize}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => {
                  maxSizeEditedRef.current = true;
                  setMaxSize(e.target.value.replace(/\D/g, ""));
                }}
                onBlur={() => {
                  const parsed = Number.parseInt(maxSize, 10);
                  const cap = Math.min(
                    MAX_LIST_SIZE,
                    credits?.balance ?? MAX_LIST_SIZE,
                  );
                  const clamped = Number.isNaN(parsed)
                    ? Math.min(DEFAULT_LIST_SIZE, cap)
                    : Math.max(1, Math.min(parsed, cap));
                  setMaxSize(String(clamped));
                }}
                disabled={formDisabled}
                aria-describedby="gen-listsize-hint"
              />
              <span className="lists-size-unit">leads</span>
            </div>
            {/* Kurzer Hinweis, nur die uebrigen Credits (Zahl in Gold =
                Credit-Faden). Das volle "X von Y"-Bild traegt der
                Header-Ring + der /account-Balken; hier reicht die
                handlungsrelevante Restzahl. Paid-Copy ("You have X
                credits") kommt mit der IAP-Verdrahtung. */}
            {credits && (
              <p id="gen-listsize-hint" className="lists-field-hint">
                You have{" "}
                <span className="lists-credit-num">
                  {credits.balance.toLocaleString()}
                </span>{" "}
                free lead credits left
              </p>
            )}
          </div>

          {/* Website-Filter als Segmented Control (Jan-Wahl 2026-08-05,
              ersetzt Dropdown + eigenen "Filters"-Abschnitt): alle Modi
              sichtbar, der "No website"-Hero ist ohne Aufklappen da.
              Full-width = responsiv (Mobile drei Drittel). */}
          <div className="beta-field">
            <label className="beta-field-label">Website</label>
            <div className="lists-seg" role="group" aria-label="Website filter">
              {WEBSITE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    "lists-seg-btn" +
                    (websiteFilter === option.value ? " is-on" : "")
                  }
                  aria-pressed={websiteFilter === option.value}
                  onClick={() => setWebsiteFilter(option.value)}
                  disabled={formDisabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* Subtitle immer sichtbar — formuliert den gewaehlten Modus
                aus (auch bei "All"). Bei "No website" folgt darunter die
                ehrliche E-Mail-Konsequenz (§13d): ohne Website gibt es
                nichts zu scrapen. */}
            <p className="lists-field-hint">
              {
                WEBSITE_FILTER_OPTIONS.find((o) => o.value === websiteFilter)
                  ?.subtitle
              }
            </p>
            {websiteFilter === "without" && (
              <p className="lists-field-hint">
                No emails on these — we pull emails from a business&apos;s
                website, and these don&apos;t have one. Every lead still has
                a phone number.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="beta-submit lists-generate-btn"
            aria-busy={submitting}
            disabled={formDisabled}
          >
            {submitting ? (
              "Starting…"
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Build my list
              </>
            )}
          </button>

          {formError && (
            <p className="beta-submit-error" role="alert">
              {formError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

