"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { CityAutocomplete } from "../lists/CityAutocomplete";
import { CountryAutocomplete } from "../lists/CountryAutocomplete";
import { FREE_LIST_SIZE, INDUSTRY_SUGGESTIONS } from "@/lib/lists/config";
import type { WebsiteFilterMode } from "@/lib/lists/pipeline";

/**
 * Lead-Listen-Sektion auf /account — das Logged-in-Zuhause des
 * Listen-Generators (Architektur-Entscheidung 2026-07-13: EIN Zuhause
 * fuer beide Funnel, /lists ist nur noch die Logged-out-Tuer).
 *
 * Zustandsgesteuert statt herkunftsgesteuert — die Seite muss App-
 * Landing-Signups UND Listen-Funnel-Signups gleichwertig abholen, und
 * der beobachtbare Zustand ist fuer beide wahr:
 *   - keine Liste  → Generator prominent ("first list free")
 *   - Job laeuft   → Building-State (App-Install wartet direkt darunter)
 *   - Liste fertig → Listen-Card + Download; die App-Card darunter
 *                    uebernimmt den Install-Push
 */

type JobStatus = "pending" | "processing" | "ready" | "failed";

interface JobView {
  id: string;
  status: JobStatus;
  error: string | null;
  leadCount: number | null;
  listId: string | null;
  listName: string | null;
  params: {
    industry?: string;
    city?: string;
    country?: string;
    website?: WebsiteFilterMode;
  };
  createdAt: string;
}

interface PreviewLead {
  company_name: string;
  phone: string;
  location: string | null;
  industry: string | null;
  custom_fields?: Record<string, string>;
}

interface StatusResponse {
  job: JobView | null;
  preview?: PreviewLead[];
}

const POLL_INTERVAL_MS = 5000;

const WEBSITE_FILTER_OPTIONS: Array<{
  value: WebsiteFilterMode;
  label: string;
}> = [
  { value: "any", label: "All businesses" },
  { value: "without", label: "Without a website" },
  { value: "with", label: "With a website" },
];

function failureMessage(job: JobView): string {
  if (job.error === "no_results") {
    return job.params.website && job.params.website !== "any"
      ? "We couldn't find callable leads matching that website filter. Try a bigger city, or set the filter back to all businesses."
      : "We couldn't find enough callable leads for that search. Try a broader industry or a nearby bigger city.";
  }
  return "Something went wrong while building your list. Please try again.";
}

function websiteFilterNote(mode: WebsiteFilterMode | undefined): string {
  if (mode === "without") return " Businesses without a website only.";
  if (mode === "with") return " Businesses with a website only.";
  return "";
}

export function LeadListsSection() {
  const [statusData, setStatusData] = useState<
    StatusResponse | null | undefined
  >(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>("DE");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilterMode>("any");

  // Preset aus Affiliate-/Funnel-Links (?website=without) — reist durch
  // Signup + /lists-Redirect bis hierher.
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("website");
    if (preset === "without" || preset === "with") {
      setWebsiteFilter(preset);
    }
  }, []);

  const fetchStatus = useCallback(
    async (jobId?: string): Promise<StatusResponse> => {
      const suffix = jobId ? `?job=${jobId}` : "";
      const response = await fetch(`/api/lists/status${suffix}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return (await response.json()) as StatusResponse;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    fetchStatus()
      .then((data) => active && setStatusData(data))
      .catch(() => active && setStatusData(null));
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  const job = statusData?.job ?? null;
  const jobRunning =
    job !== null && (job.status === "pending" || job.status === "processing");

  useEffect(() => {
    if (!jobRunning || !job) return;
    const timer = setInterval(() => {
      fetchStatus(job.id)
        .then(setStatusData)
        .catch(() => {
          // Poll-Fehler still schlucken — der Job laeuft server-seitig
          // weiter, der naechste Tick versucht es erneut.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobRunning, job, fetchStatus]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
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
        body: JSON.stringify({ industry, city, country, website: websiteFilter }),
      });

      if (response.status === 409) {
        setStatusData(await fetchStatus());
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
      setStatusData(await fetchStatus(jobId));
    } catch {
      setFormError("Network hiccup — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (statusData === undefined) {
    return (
      <section className="account-card">
        <p className="account-hint" style={{ margin: 0 }}>
          Loading your lead lists…
        </p>
      </section>
    );
  }

  if (jobRunning && job) {
    return <BuildingCard job={job} />;
  }
  if (job?.status === "ready") {
    return <ReadyCard job={job} preview={statusData?.preview ?? []} />;
  }
  return (
    <GeneratorCard
      industry={industry}
      city={city}
      country={country}
      websiteFilter={websiteFilter}
      submitting={submitting}
      formError={formError}
      failedJob={job?.status === "failed" ? job : null}
      onIndustryChange={setIndustry}
      onCityChange={setCity}
      onCountryChange={setCountry}
      onWebsiteFilterChange={setWebsiteFilter}
      onSubmit={handleGenerate}
    />
  );
}

interface GeneratorCardProps {
  industry: string;
  city: string;
  country: string | null;
  websiteFilter: WebsiteFilterMode;
  submitting: boolean;
  formError: string | null;
  failedJob: JobView | null;
  onIndustryChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string | null) => void;
  onWebsiteFilterChange: (value: WebsiteFilterMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function GeneratorCard({
  industry,
  city,
  country,
  websiteFilter,
  submitting,
  formError,
  failedJob,
  onIndustryChange,
  onCityChange,
  onCountryChange,
  onWebsiteFilterChange,
  onSubmit,
}: GeneratorCardProps) {
  return (
    <section
      className="account-card"
      style={{
        borderColor: "rgba(37,99,232,0.3)",
        background:
          "linear-gradient(180deg, rgba(37,99,232,0.06) 0%, rgba(255,255,255,1) 100%)",
      }}
    >
      <h2 className="account-card-title">
        Get your first lead list — free
      </h2>
      <p className="account-body">
        Pick an industry and a city — we scan Google Maps and build a
        call-ready list of up to {FREE_LIST_SIZE} leads. Phone numbers only,
        deduped, synced straight to the Callday app.
      </p>

      {failedJob && (
        <p className="beta-submit-error" role="alert">
          {failureMessage(failedJob)}
        </p>
      )}

      <form className="beta-form" onSubmit={onSubmit} noValidate>
        <div className="beta-field">
          <label className="beta-field-label" htmlFor="account-industry-input">
            Industry
          </label>
          <input
            id="account-industry-input"
            type="text"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
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
                onClick={() => onIndustryChange(suggestion)}
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
          onChange={onCountryChange}
        />

        <CityAutocomplete
          value={city}
          country={country}
          disabled={submitting}
          onChange={onCityChange}
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
                onClick={() => onWebsiteFilterChange(option.value)}
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
      <p className="account-hint">
        Your first list is free. No credit card.
      </p>
    </section>
  );
}

function BuildingCard({ job }: { job: JobView }) {
  const industry = job.params.industry ?? "your industry";
  const city = job.params.city ?? "your city";

  return (
    <section className="account-card">
      <h2 className="account-card-title">Building your list…</h2>
      <p className="account-body">
        Scanning Google Maps for {industry} in {city}.
        {websiteFilterNote(job.params.website)} This usually takes 1 to 3
        minutes.
      </p>
      <div
        className="lists-progress-track"
        role="progressbar"
        aria-label="Building your list"
      >
        <div className="lists-progress-fill" />
      </div>
      <p className="account-hint">
        You can close this page — we&apos;ll email you when it&apos;s ready.
        Meanwhile: your list is already syncing to the Callday app, install
        it below.
      </p>
    </section>
  );
}

/**
 * Stilisierte Callday-Pre-Call-Karte mit dem ersten echten Lead —
 * verkauft das Erlebnis, nicht nur die Daten. Bewusst vereinfacht,
 * kein pixelgenauer App-Zwilling, nicht interaktiv.
 */
function LeadPreviewCard({ lead }: { lead: PreviewLead }) {
  const rating = lead.custom_fields?.google_rating;
  const meta = [lead.industry, lead.location].filter(Boolean).join(" — ");

  return (
    <div
      className="lists-precall-stack"
      aria-label="Preview of your first lead as a Callday call card"
    >
      <div className="lists-precall-shadow lists-precall-shadow-2" aria-hidden="true" />
      <div className="lists-precall-shadow lists-precall-shadow-1" aria-hidden="true" />
      <div className="lists-precall-card">
        <p className="lists-precall-label">Your first call</p>
        <p className="lists-precall-name">{lead.company_name}</p>
        {meta && <p className="lists-precall-meta">{meta}</p>}
        {rating && <p className="lists-precall-rating">{rating}</p>}
        <div className="lists-precall-callbtn" aria-hidden="true">
          Call {lead.phone}
        </div>
        <div className="lists-precall-ghost-row" aria-hidden="true">
          <span className="lists-precall-ghost">Skip</span>
          <span className="lists-precall-ghost">Called</span>
        </div>
      </div>
    </div>
  );
}

function ReadyCard({
  job,
  preview,
}: {
  job: JobView;
  preview: PreviewLead[];
}) {
  const leadCount = job.leadCount ?? 0;
  const firstLead = preview[0];

  return (
    <section className="account-card">
      <h2 className="account-card-title">Your lead list</h2>
      <div className="account-row">
        <span className="account-row-label">{job.listName}</span>
        <span className="account-row-value">{leadCount} callable leads</span>
      </div>

      {firstLead && (
        <div style={{ margin: "16px 0 4px" }}>
          <LeadPreviewCard lead={firstLead} />
          {leadCount > 1 && (
            <p className="lists-stack-note" style={{ marginBottom: 0 }}>
              + {leadCount - 1} more waiting in your stack
            </p>
          )}
        </div>
      )}

      {job.listId && (
        <a
          href={`/api/lists/download?list=${job.listId}&format=xlsx`}
          className="account-btn account-btn-secondary"
        >
          Download for Excel
        </a>
      )}

      <p className="account-hint">
        Your list is already synced — it&apos;ll be waiting in the Callday
        app.
        {job.listId && (
          <>
            {" "}
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
  );
}
