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
import { IndustryAutocomplete } from "../IndustryAutocomplete";
import { LocationsField, type LocationChip } from "../LocationsField";
import {
  failureMessage,
  fetchJobStatus,
  type JobView,
  type StatusResponse,
} from "../job-view";
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
 * Laeuft ein Job, uebernimmt die Building-Ansicht mit echten
 * Pipeline-Stufen (pending = Scan, processing = Verarbeitung — keine
 * simulierten Fortschritte).
 *
 * /lists/new ist DIE eine Generator-URL (Jan-Entscheidung 2026-07-14) —
 * die fertige Free-Liste hat hier keine eigene Ansicht mehr, sie wohnt
 * auf /lists. Zustaende aus /api/lists/status (geteilte View-Typen in
 * ../job-view): kein Job/failed → Form, pending/processing → Building,
 * ready → Form gesperrt (ausgegraut + Hinweis warum, Free-Cap 1
 * verbraucht). Wird der Job in derselben Session fertig, leiten wir
 * direkt zu /lists weiter — der Payoff ist die Liste, nicht der
 * Generator.
 */

const POLL_INTERVAL_MS = 5000;

// Kurze Segment-Labels (Jan-Wahl 2026-08-05: Segmented Control statt
// Dropdown). Kurz genug fuer full-width auf Mobile (3 Drittel); der
// "Website"-Feld-Label gibt den Kontext, deshalb "Any"/"No website"/
// "Has website" statt der langen "Only…"-Saetze.
const WEBSITE_FILTER_OPTIONS: Array<{
  value: WebsiteFilterMode;
  label: string;
}> = [
  { value: "any", label: "Any" },
  { value: "without", label: "No website" },
  { value: "with", label: "Has website" },
];

/**
 * Die echten Verarbeitungsschritte des Generators (Pipeline-Reihenfolge
 * aus lib/lists/jobs.ts) — Stufenanzeige im Building-State.
 */
const PIPELINE_STEPS = [
  {
    title: "Scan Google Maps",
    detail: "Every matching business in and around your city.",
  },
  {
    title: "Keep the callable ones",
    detail: "Phone number required — closed places get dropped.",
  },
  {
    title: "Dedupe & sort",
    detail: "One entry per business, exact city matches first.",
  },
  {
    title: "Sync to your account",
    detail: "The list is waiting in the Callday app.",
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

  // True sobald diese Session einen Job hat laufen sehen — unterscheidet
  // "frisch fertig gebaut" (→ Redirect zu /lists) vom Revisit (→ Form
  // gesperrt).
  const sawBuildingRef = useRef(false);

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

  useEffect(() => {
    if (jobRunning) sawBuildingRef.current = true;
  }, [jobRunning]);

  // Credit-Modell (Phase 1): gesperrt wird erst bei 0 Credits — fertige
  // Listen sperren nichts mehr, es darf nachgelegt werden, bis das
  // Konto leer ist. Das Formular bleibt sichtbar (eine URL, ein Ort),
  // im 0-Zustand ausgegraut mit Hinweis.
  const creditsExhausted = credits !== null && credits.balance < 1;
  const justBuilt = job?.status === "ready" && sawBuildingRef.current;

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

  useEffect(() => {
    if (justBuilt) router.replace("/lists");
  }, [justBuilt, router]);

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
      if (submitting || creditsExhausted) return;
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
            })),
            country,
            website: websiteFilter,
            maxSize: Number.parseInt(maxSize, 10) || DEFAULT_LIST_SIZE,
          }),
        });

        if (response.status === 409) {
          // Es laeuft schon eine Generierung (Race/Doppel-Tab) — Status
          // zeigt die Wahrheit und uebernimmt mit der Building-Ansicht.
          setStatusData(await fetchJobStatus());
          return;
        }
        if (response.status === 403) {
          // Konto leer (Race mit anderem Tab) — Status bringt die
          // 0-Credits-Sperre mit.
          setStatusData(await fetchJobStatus());
          setFormError("You've used all your free lead credits.");
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

        const { jobId } = (await response.json()) as { jobId: string };
        setStatusData(await fetchJobStatus(jobId));
      } catch {
        setFormError("Network hiccup — please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      creditsExhausted,
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

  if (jobRunning && job) {
    return <BuildingView job={job} />;
  }
  if (justBuilt) {
    // router.replace("/lists") laeuft bereits — kein Flash des
    // gesperrten Formulars zwischen Building und Redirect.
    return (
      <p className="lists-loading">Your list is ready — taking you there…</p>
    );
  }

  const formDisabled = submitting || creditsExhausted;

  return (
    <div className="lists-inner-account">
      <header className="lists-workhead">
        {/* Brand-Moment (Jan-Wahl aus 5 Header-Varianten, 2026-08-05):
            pulsierender Sun-Gold-Punkt = "live/aktiv"-Signal in der
            Marken-Zweitfarbe, dezent statt Namedropping. Copy in
            Callday-Voice, verbindet die Liste mit dem Anrufen. Puls
            respektiert prefers-reduced-motion. */}
        <div className="lists-worktitle-row">
          <span className="lists-live-dot" aria-hidden="true" />
          <h1 className="lists-worktitle">Call list Generator</h1>
        </div>
        <p className="lists-worksub">
          Scan Google Maps for your ideal customers.
        </p>
      </header>

      {job?.status === "failed" && (
        <p className="beta-submit-error lists-fail-banner" role="alert">
          {failureMessage(job)}
        </p>
      )}

      {/* 0-Credits-Sperre — bewusst OHNE Pricing-Wording (Pre-Launch-
          Regel): was danach kommt, bleibt offen. */}
      {creditsExhausted && (
        <div className="lists-locked-note" role="status">
          <div>
            <p className="lists-locked-title">
              You&apos;ve used all {credits?.signupTotal} free lead credits.
            </p>
            <p className="lists-locked-body">
              Every lead we delivered used one credit — your lists are synced
              to the Callday app and stay yours. More credits are coming soon.
            </p>
          </div>
          <Link
            href="/lists"
            className="account-btn account-btn-secondary lists-locked-btn"
          >
            View your lists
          </Link>
        </div>
      )}

      <div className={"lists-console" + (creditsExhausted ? " is-locked" : "")}>
        <form className="beta-form lists-console-form" onSubmit={handleGenerate} noValidate>
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
            <label className="beta-field-label" htmlFor="gen-listsize">
              Max list size
            </label>
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
            <p id="gen-listsize-hint" className="lists-field-hint">
              {credits
                ? `You have ${credits.balance} of ${credits.signupTotal} free lead credits — only leads that land in your list use them. If your search finds fewer, the list is smaller.`
                : "If your search finds fewer, the list is smaller."}
            </p>
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
            {/* Ehrliche E-Mail-Konsequenz im Moment der Wahl (§13d):
                ohne Website gibt es nichts zu scrapen. */}
            {websiteFilter === "without" && (
              <p className="lists-field-hint">
                No emails on these — businesses without a website have
                nothing to scrape. Every lead still has a phone number.
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

function BuildingView({ job }: { job: JobView }) {
  const industry =
    job.params.industry_display ?? job.params.industry ?? "your industry";
  const city = job.params.city ?? "your city";
  // Ehrliche Stufen-Zuordnung: pending = Outscraper scannt (Stufe 1),
  // processing = unsere Pipeline laeuft (Stufe 2) — keine Fake-Timer.
  const activeStep = job.status === "pending" ? 0 : 1;

  return (
    <div className="lists-inner">
      <header className="lists-workhead">
        <h1 className="lists-worktitle">Building your list…</h1>
        <p className="lists-worksub">
          {industry} in {city} — this usually takes 1 to 3 minutes.
        </p>
      </header>

      <section className="lists-buildcard">
        <ol className="lists-pipeline">
          {PIPELINE_STEPS.map((step, index) => {
            const state =
              index < activeStep
                ? "is-done"
                : index === activeStep
                  ? "is-active"
                  : "";
            return (
              <li key={step.title} className={`lists-pipeline-step ${state}`}>
                <span className="lists-step-marker" aria-hidden="true">
                  {index < activeStep ? "✓" : index + 1}
                </span>
                <div>
                  <p className="lists-pipeline-striptitle">{step.title}</p>
                  <p className="lists-pipeline-stripdetail">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div
          className="lists-progress-track"
          role="progressbar"
          aria-label="Building your list"
        >
          <div className="lists-progress-fill" />
        </div>

        <p className="account-hint">
          You can close this page — we&apos;ll email you when it&apos;s
          ready. Meanwhile: your list is already syncing to the Callday app,{" "}
          <Link className="lists-meta-link" href={APP_DOWNLOAD_PATH}>
            grab the app in your account
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

