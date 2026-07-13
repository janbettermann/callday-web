"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { CityAutocomplete } from "../CityAutocomplete";
import { CountryAutocomplete } from "../CountryAutocomplete";
import { LeadPreviewCard } from "../LeadPreviewCard";
import {
  failureMessage,
  fetchJobStatus,
  type JobView,
  type PreviewLead,
  type StatusResponse,
} from "../job-view";
import {
  APP_DOWNLOAD_PATH,
  FREE_LIST_SIZE,
  INDUSTRY_SUGGESTIONS,
} from "@/lib/lists/config";
import type { WebsiteFilterMode } from "@/lib/lists/pipeline";

/**
 * Generator-Konsole auf /lists/new — Formular links, Live-Summary
 * rechts ("was du bekommst" spiegelt die Eingaben), darunter die
 * Pipeline als How-it-works-Strip. Laeuft ein Job, uebernimmt die
 * Building-Ansicht mit echten Pipeline-Stufen (pending = Scan,
 * processing = Verarbeitung — keine simulierten Fortschritte).
 *
 * Zustaende kommen aus /api/lists/status (geteilte View-Typen in
 * ../job-view): kein Job/failed → Form, pending/processing → Building,
 * ready → Ready-Ansicht (frisch gebaut ODER Revisit — Copy passt fuer
 * beide, weil der Free-Cap 1 die fertige Liste zum Seitenzustand macht).
 */

const POLL_INTERVAL_MS = 5000;

const WEBSITE_FILTER_OPTIONS: Array<{
  value: WebsiteFilterMode;
  label: string;
}> = [
  { value: "any", label: "All businesses" },
  { value: "without", label: "Without a website" },
  { value: "with", label: "With a website" },
];

/**
 * Die echten Verarbeitungsschritte des Generators (Pipeline-Reihenfolge
 * aus lib/lists/jobs.ts). Doppelte Rolle: How-it-works-Strip unter dem
 * Formular + Stufenanzeige im Building-State.
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

function websiteSummaryLabel(mode: WebsiteFilterMode): string {
  if (mode === "without") return "Only businesses without a website";
  if (mode === "with") return "Only businesses with a website";
  return "All businesses, with or without a website";
}

export function GeneratorClient() {
  const [statusData, setStatusData] = useState<
    StatusResponse | null | undefined
  >(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>("DE");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilterMode>("any");

  // True sobald diese Session einen Job hat laufen sehen — steuert nur
  // die Ready-Headline ("is ready" vs. Revisit-"Your free list").
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
      if (submitting) return;
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
    [submitting, industry, city, country, websiteFilter],
  );

  if (statusData === undefined) {
    return <p className="lists-loading">Loading…</p>;
  }

  if (jobRunning && job) {
    return <BuildingView job={job} />;
  }
  if (job?.status === "ready") {
    return (
      <ReadyView
        job={job}
        preview={statusData?.preview ?? []}
        justBuilt={sawBuildingRef.current}
      />
    );
  }

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

      <div className="lists-console">
        <form className="beta-form lists-console-form" onSubmit={handleGenerate} noValidate>
          <div className="beta-field">
            <label className="beta-field-label" htmlFor="gen-industry-input">
              Industry
            </label>
            <input
              id="gen-industry-input"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Dentists"
              maxLength={60}
              disabled={submitting}
            />
            <div className="lists-chip-row" aria-label="Industry suggestions">
              {INDUSTRY_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="lists-chip"
                  onClick={() => setIndustry(suggestion)}
                  disabled={submitting}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <CountryAutocomplete
            code={country}
            disabled={submitting}
            onChange={setCountry}
          />

          <CityAutocomplete
            value={city}
            country={country}
            disabled={submitting}
            onChange={setCity}
          />

          <div className="beta-field">
            <span className="beta-field-label">Website</span>
            <div
              className="lists-chip-row lists-filter-row"
              role="radiogroup"
              aria-label="Website filter"
            >
              {WEBSITE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={websiteFilter === option.value}
                  className={
                    "lists-chip" +
                    (websiteFilter === option.value ? " is-active" : "")
                  }
                  onClick={() => setWebsiteFilter(option.value)}
                  disabled={submitting}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="beta-submit"
            aria-busy={submitting}
            disabled={submitting}
          >
            {submitting ? "Starting…" : "Generate my list"}
          </button>

          {formError && (
            <p className="beta-submit-error" role="alert">
              {formError}
            </p>
          )}
        </form>

        <SummaryPanel
          industry={industry}
          city={city}
          websiteFilter={websiteFilter}
        />
      </div>

      <section className="lists-pipeline-strip" aria-label="How it works">
        {PIPELINE_STEPS.map((step, index) => (
          <div key={step.title} className="lists-pipeline-stripstep">
            <span className="lists-step-num">{index + 1}</span>
            <div>
              <p className="lists-pipeline-striptitle">{step.title}</p>
              <p className="lists-pipeline-stripdetail">{step.detail}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Live-Summary rechts neben dem Formular — spiegelt die Eingaben als
 * "das bekommst du"-Karte. Der Panel waechst spaeter mit Credits-Kosten
 * und Enricher-Zeilen weiter (Spec §10/§13c).
 */
function SummaryPanel({
  industry,
  city,
  websiteFilter,
}: {
  industry: string;
  city: string;
  websiteFilter: WebsiteFilterMode;
}) {
  const hasQuery = Boolean(industry.trim() && city.trim());

  return (
    <aside className="lists-summary" aria-label="What you'll get">
      <p className="lists-summary-eyebrow">Your list</p>
      <p
        className={
          "lists-summary-title" + (hasQuery ? "" : " is-placeholder")
        }
      >
        {hasQuery
          ? `${industry.trim()} – ${city.trim()}`
          : "Pick an industry and a city"}
      </p>
      <ul className="lists-summary-specs">
        <li>Up to {FREE_LIST_SIZE} callable leads</li>
        <li>Phone number on every lead</li>
        <li>{websiteSummaryLabel(websiteFilter)}</li>
        <li>Deduped — one entry per business</li>
        <li>Synced straight to the Callday app</li>
      </ul>
      <div className="lists-summary-price">
        <span>Price</span>
        <span className="lists-summary-free">Free</span>
      </div>
      <p className="lists-summary-hint">
        Your first list is on us. No credit card.
      </p>
    </aside>
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

function ReadyView({
  job,
  preview,
  justBuilt,
}: {
  job: JobView;
  preview: PreviewLead[];
  justBuilt: boolean;
}) {
  const leadCount = job.leadCount ?? 0;
  const firstLead = preview[0];

  return (
    <div className="lists-inner">
      <header className="lists-workhead">
        <h1 className="lists-worktitle">
          {justBuilt ? "Your list is ready." : "Your free list"}
        </h1>
        <p className="lists-worksub">
          {job.listName} — {leadCount} callable leads, synced to the Callday
          app.
        </p>
      </header>

      <section className="account-card">
        {firstLead && (
          <div style={{ margin: "4px 0" }}>
            <LeadPreviewCard lead={firstLead} />
            {leadCount > 1 && (
              <p className="lists-stack-note" style={{ marginBottom: 0 }}>
                + {leadCount - 1} more waiting in your stack
              </p>
            )}
          </div>
        )}

        <div className="lists-ready-actions">
          <Link href="/lists" className="account-btn account-btn-primary">
            View your lists
          </Link>
          {job.listId && (
            <a
              href={`/api/lists/download?list=${job.listId}&format=xlsx`}
              className="account-btn account-btn-secondary"
            >
              Download for Excel
            </a>
          )}
        </div>

        <p className="account-hint">
          {job.listId && (
            <>
              Prefer a plain file?{" "}
              <a
                className="lists-meta-link"
                href={`/api/lists/download?list=${job.listId}`}
              >
                Download CSV
              </a>
              .
            </>
          )}{" "}
          Need another list? That&apos;s coming soon.
        </p>
      </section>
    </div>
  );
}
