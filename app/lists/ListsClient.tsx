"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import { CalldayLogo } from "../components/CalldayLogo";
import { SignupForm } from "../components/SignupForm";
import { CityAutocomplete } from "./CityAutocomplete";
import { CountryAutocomplete } from "./CountryAutocomplete";
import { useIsLoggedIn } from "@/lib/use-is-logged-in";
import {
  APP_DOWNLOAD_PATH,
  FREE_LIST_SIZE,
  INDUSTRY_SUGGESTIONS,
} from "@/lib/lists/config";

/**
 * /lists — eine Seite, drei Zustaende (Spec: specs/lists-generator.md):
 *
 *   1. Ausgeloggt  → list-spezifischer Hero + SignupForm (Signup ist der
 *      Wertabgriff der Gratis-Liste; nextPath fuehrt zurueck hierher).
 *   2. Generator   → Branche + Stadt + Land, ein CTA. Keine Filter —
 *      jede Option waere eine Prokrastinations-Einladung.
 *   3. Building    → Progress + der Funnel-Slot: waehrend der 1–3 Min
 *      Wartezeit wird die App als besseres Zuhause der Liste gepitcht.
 *   4. Ready       → Zahl als Held, Preview als Beweis, App-CTA primaer,
 *      CSV-Download bewusst ungehindert daneben (kein Download-Gate).
 *
 * Der Seitenzustand haengt am neuesten Job des Users (Cap = 1 Gratis-
 * Liste, der letzte Job IST der Zustand). Pending wird alle 5s gepollt;
 * der Status-Endpoint heilt verlorene Webhooks server-seitig selbst.
 */

type JobStatus = "pending" | "processing" | "ready" | "failed";

interface JobView {
  id: string;
  status: JobStatus;
  error: string | null;
  leadCount: number | null;
  listId: string | null;
  listName: string | null;
  params: { industry?: string; city?: string; country?: string };
  createdAt: string;
}

interface PreviewLead {
  company_name: string;
  phone: string;
  location: string | null;
}

interface StatusResponse {
  job: JobView | null;
  preview?: PreviewLead[];
}

const POLL_INTERVAL_MS = 5000;

function failureMessage(error: string | null): string {
  if (error === "no_results") {
    return "We couldn't find enough callable leads for that search. Try a broader industry or a nearby bigger city.";
  }
  return "Something went wrong while building your list. Please try again.";
}

export function ListsClient() {
  const loggedIn = useIsLoggedIn();

  // undefined = noch nicht geladen, null = Laden fehlgeschlagen.
  const [statusData, setStatusData] = useState<
    StatusResponse | null | undefined
  >(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  // null = kein Land eingerastet (Freitext im Country-Feld) — der
  // Generator braucht einen ISO-Code, das prueft die Submit-Validation.
  const [country, setCountry] = useState<string | null>("DE");

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
    if (!loggedIn) return;
    let active = true;
    fetchStatus()
      .then((data) => active && setStatusData(data))
      .catch(() => active && setStatusData(null));
    return () => {
      active = false;
    };
  }, [loggedIn, fetchStatus]);

  const job = statusData?.job ?? null;
  const jobRunning =
    job !== null && (job.status === "pending" || job.status === "processing");

  useEffect(() => {
    if (!jobRunning || !job) return;
    const timer = setInterval(() => {
      fetchStatus(job.id)
        .then(setStatusData)
        .catch(() => {
          // Poll-Fehler still schlucken — der naechste Tick probiert es
          // wieder, der Job laeuft server-seitig unabhaengig weiter.
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
        body: JSON.stringify({ industry, city, country }),
      });

      if (response.status === 409) {
        // Free-Liste existiert schon (z. B. zweiter Tab) — Zustand neu
        // laden, die Seite zeigt dann Ready/Building statt des Forms.
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

  return (
    <>
      <ListsNav loggedIn={loggedIn} />
      <main className="lists-page">
        <div className="lists-inner">
          {!loggedIn ? (
            <SignedOutView />
          ) : statusData === undefined ? (
            <p className="lists-loading">Loading…</p>
          ) : jobRunning && job ? (
            <BuildingView job={job} />
          ) : job?.status === "ready" ? (
            <ReadyView job={job} preview={statusData?.preview ?? []} />
          ) : (
            <GeneratorForm
              industry={industry}
              city={city}
              country={country}
              submitting={submitting}
              formError={formError}
              failedJob={job?.status === "failed" ? job : null}
              onIndustryChange={setIndustry}
              onCityChange={setCity}
              onCountryChange={setCountry}
              onSubmit={handleGenerate}
            />
          )}
        </div>
      </main>
    </>
  );
}

/**
 * Sub-Brand-Nav: Logo + "Lists"-Pille, Muster wie AffiliateNav (dort mit
 * Hamburger-Menue — hier reicht ein einzelner Account-Link, deshalb kein
 * geteilter Nav-Component; bei einem dritten Sub-Brand konsolidieren).
 */
const subBrandPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 100,
  background: "rgba(53, 100, 224, 0.1)",
  border: "0.5px solid rgba(53, 100, 224, 0.22)",
  color: "var(--blue-deep)",
  fontFamily: "var(--font-label)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  lineHeight: 1,
};

function ListsNav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <nav className="site-nav" data-scrolled="true">
      <div className="container nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
          <span style={subBrandPillStyle}>Lists</span>
        </div>
        <Link
          className="nav-cta"
          href={loggedIn ? "/account" : "/login?next=%2Flists"}
        >
          {loggedIn ? "Account" : "Sign in"}
        </Link>
      </div>
    </nav>
  );
}

function ListsHero({ sub }: { sub: string }) {
  return (
    <header className="lists-hero">
      <h1 className="lists-headline">
        Your cold-calling list, in 2 minutes.
      </h1>
      <p className="lists-sub">{sub}</p>
    </header>
  );
}

function SignedOutView() {
  return (
    <>
      <ListsHero sub="Pick an industry and a city. We build a call-ready lead list — every lead with a phone number, deduped, ready to dial. Your first list is free." />
      <SignupForm nextPath="/lists" />
      <p className="lists-meta">
        Free — no credit card. Your list syncs straight to the Callday app.
      </p>
    </>
  );
}

interface GeneratorFormProps {
  industry: string;
  city: string;
  country: string | null;
  submitting: boolean;
  formError: string | null;
  failedJob: JobView | null;
  onIndustryChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function GeneratorForm({
  industry,
  city,
  country,
  submitting,
  formError,
  failedJob,
  onIndustryChange,
  onCityChange,
  onCountryChange,
  onSubmit,
}: GeneratorFormProps) {
  return (
    <>
      <ListsHero sub="Pick an industry and a city — we scan Google Maps and build your call-ready list. Phone numbers only, deduped." />

      {failedJob && (
        <p className="beta-submit-error" role="alert">
          {failureMessage(failedJob.error)}
        </p>
      )}

      <div className="login-card lists-card">
        <form className="beta-form" onSubmit={onSubmit} noValidate>
          <label className="beta-field">
            <span className="beta-field-label">Industry</span>
            <input
              type="text"
              value={industry}
              onChange={(e) => onIndustryChange(e.target.value)}
              placeholder="Dentists"
              maxLength={60}
              disabled={submitting}
            />
          </label>
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
      </div>
      <p className="lists-meta">
        Your first list is free — up to {FREE_LIST_SIZE} callable leads. No
        credit card.
      </p>
    </>
  );
}

function BuildingView({ job }: { job: JobView }) {
  const industry = job.params.industry ?? "your industry";
  const city = job.params.city ?? "your city";

  return (
    <>
      <header className="lists-hero">
        <h1 className="lists-headline">Building your list…</h1>
        <p className="lists-sub">
          Scanning Google Maps for {industry} in {city}. This usually takes 1
          to 3 minutes.
        </p>
      </header>

      <div
        className="lists-progress-track"
        role="progressbar"
        aria-label="Building your list"
      >
        <div className="lists-progress-fill" />
      </div>

      <div className="account-card lists-app-card">
        <h2 className="account-card-title">
          Meanwhile — your list is already syncing to Callday
        </h2>
        <ul className="pricing-card-list lists-app-benefits">
          <li>Call straight from your iPhone — one tap per lead</li>
          <li>Every outcome tracked automatically</li>
          <li>Meetings land in your calendar with confirmation emails</li>
        </ul>
        <Link
          href={APP_DOWNLOAD_PATH}
          className="account-btn account-btn-primary"
        >
          Get the Callday app
        </Link>
      </div>

      <p className="lists-meta">
        You can close this tab — we&apos;ll email you when your list is
        ready.
      </p>
    </>
  );
}

function ReadyView({
  job,
  preview,
}: {
  job: JobView;
  preview: PreviewLead[];
}) {
  const leadCount = job.leadCount ?? 0;

  return (
    <>
      <header className="lists-hero">
        <span className="lists-ready-badge" aria-hidden="true">
          ✓
        </span>
        <h1 className="lists-headline">
          {leadCount} callable leads
        </h1>
        <p className="lists-sub">
          {job.listName} — deduped, phone numbers only.
        </p>
      </header>

      {preview.length > 0 && (
        <div className="lists-preview">
          {preview.map((lead) => (
            <div
              key={`${lead.company_name}-${lead.phone}`}
              className="lists-preview-row"
            >
              <span className="lists-preview-name">{lead.company_name}</span>
              <span className="lists-preview-phone">{lead.phone}</span>
            </div>
          ))}
          {leadCount > preview.length && (
            <div className="lists-preview-more">
              + {leadCount - preview.length} more in your list
            </div>
          )}
        </div>
      )}

      <div className="lists-actions">
        <Link
          href={APP_DOWNLOAD_PATH}
          className="account-btn account-btn-primary"
        >
          Get the Callday app
        </Link>
        {job.listId && (
          <a
            href={`/api/lists/download?list=${job.listId}`}
            className="account-btn account-btn-secondary"
          >
            Download CSV
          </a>
        )}
      </div>

      <p className="lists-meta">
        Your list is already in your Callday account — it&apos;ll be waiting
        when you open the app.
      </p>
    </>
  );
}
