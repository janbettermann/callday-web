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
import { CityAutocomplete } from "../CityAutocomplete";
import { CountryAutocomplete } from "../CountryAutocomplete";
import { IndustryAutocomplete } from "../IndustryAutocomplete";
import {
  failureMessage,
  fetchJobStatus,
  type JobView,
  type StatusResponse,
} from "../job-view";
import {
  APP_DOWNLOAD_PATH,
  COUNTRY_SUGGESTIONS,
  FREE_LIST_SIZE,
  INDUSTRY_SUGGESTIONS,
} from "@/lib/lists/config";
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

// "Only…"-Formulierung macht die Einschraenkung eindeutig (Jan-Copy-
// Entscheidung 2026-07-15) — "With a website" allein liest sich auch
// als "einschliessen" statt "einschraenken".
const WEBSITE_FILTER_OPTIONS: Array<{
  value: WebsiteFilterMode;
  label: string;
}> = [
  { value: "any", label: "With and without website" },
  { value: "without", label: "Only without website" },
  { value: "with", label: "Only with website" },
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
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>("DE");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilterMode>("any");

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
  const jobRunning =
    job !== null && (job.status === "pending" || job.status === "processing");

  useEffect(() => {
    if (jobRunning) sawBuildingRef.current = true;
  }, [jobRunning]);

  // Free-Cap 1: eine fertige Liste sperrt den Generator — das Formular
  // bleibt sichtbar (eine URL, ein Ort), ist aber ausgegraut mit Hinweis.
  const freeUsed = job?.status === "ready";
  const justBuilt = freeUsed && sawBuildingRef.current;

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
      // freeUsed-Guard ist Gurt zur Hose: server-seitig erzwingt der
      // partial unique index den Free-Cap ohnehin (409).
      if (submitting || freeUsed) return;
      setFormError(null);

      if (!industry.trim() || !city.trim()) {
        setFormError("Add an industry and a city — that's all we need.");
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
            industry,
            city,
            country,
            website: websiteFilter,
          }),
        });

        if (response.status === 409) {
          // Free-Slot schon belegt (Race/Doppel-Tab) — Status zeigt die
          // Wahrheit: laufender Job oder fertige Liste.
          setStatusData(await fetchJobStatus());
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
    [submitting, freeUsed, industry, city, country, websiteFilter],
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

  const formDisabled = submitting || freeUsed;

  return (
    <div className="lists-inner-wide">
      <header className="lists-workhead">
        <Link href="/lists" className="lists-backlink">
          ← Your lists
        </Link>
        <h1 className="lists-worktitle">New lead list</h1>
        <p className="lists-worksub">
          Tell us who you want to call — we handle the rest.
        </p>
      </header>

      {job?.status === "failed" && (
        <p className="beta-submit-error lists-fail-banner" role="alert">
          {failureMessage(job)}
        </p>
      )}

      {freeUsed && (
        <div className="lists-locked-note" role="status">
          <div>
            <p className="lists-locked-title">
              Your free list is already built.
            </p>
            <p className="lists-locked-body">
              One free list per account — yours is synced to the Callday app
              and waiting in your lists. Need another one? That&apos;s coming
              soon.
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

      <div className={"lists-console" + (freeUsed ? " is-locked" : "")}>
        <form className="beta-form lists-console-form" onSubmit={handleGenerate} noValidate>
          <IndustryAutocomplete
            value={industry}
            disabled={formDisabled}
            onChange={setIndustry}
            suggestions={INDUSTRY_SUGGESTIONS}
            required
          />

          {/* Country + City in einer Zeile, darunter die Country-
              Schnellwahl-Pillen (v2-Layout). */}
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
                <CityAutocomplete
                  value={city}
                  country={country}
                  disabled={formDisabled}
                  onChange={setCity}
                />
              </div>
            </div>
            <div className="lists-try" aria-label="Country shortcuts">
              Try:
              {COUNTRY_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="lists-try-chip"
                  onClick={() => setCountry(suggestion)}
                  disabled={formDisabled}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Listengroesse — im Free-State fix (250), deaktiviert. Der
              bediente Regler kommt mit der Credits-Runde; hier bewusst
              OHNE Credits-/Pricing-Wording (Pre-Launch-Regel). */}
          <div className="beta-field">
            <label className="beta-field-label" htmlFor="gen-listsize">
              List size
            </label>
            <div className="lists-size-row">
              <input
                id="gen-listsize"
                className="lists-size-input"
                type="text"
                value={FREE_LIST_SIZE}
                inputMode="numeric"
                disabled
                readOnly
                aria-describedby="gen-listsize-hint"
              />
              <span className="lists-size-unit">leads</span>
            </div>
            <p id="gen-listsize-hint" className="lists-field-hint">
              Your free list includes up to {FREE_LIST_SIZE} leads.
            </p>
          </div>

          {/* Eigener Filters-Abschnitt (Dropdown statt Chips,
              Jan-Entscheidung 2026-07-15, Spec §13b). */}
          <div className="lists-filters-section">
            <span className="lists-section-title">Filters</span>
            <div className="beta-field">
              <label className="beta-field-label" htmlFor="gen-website-select">
                Website
              </label>
              <select
                id="gen-website-select"
                className="lists-select"
                value={websiteFilter}
                onChange={(e) =>
                  setWebsiteFilter(e.target.value as WebsiteFilterMode)
                }
                disabled={formDisabled}
              >
                {WEBSITE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* Ehrliche E-Mail-Konsequenz im Moment der Wahl (§13d):
                  ohne Website gibt es nichts zu scrapen. */}
              {websiteFilter === "without" && (
                <p className="lists-field-hint">
                  No emails on these — businesses without a website have
                  nothing to scrape. Every lead still has a phone number.
                </p>
              )}
            </div>
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
  const industry = job.params.industry ?? "your industry";
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

