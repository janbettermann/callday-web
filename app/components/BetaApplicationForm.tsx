"use client";

import { useState, type FormEvent } from "react";

type WeeklyCalls = "" | "under_10" | "10_30" | "30_100" | "over_100";
type CurrentTool = "" | "crm" | "spreadsheet" | "nothing" | "other";

/**
 * Success outcome decided by the backend after submit. The form itself
 * never asks the user to choose — both outcomes are equal wins:
 *   - "beta"     → one of the 50 closed-beta slots this round
 *   - "waitlist" → launch list with founder pricing + 1 month free
 *
 * MVP: backend isn't wired yet, so we always render "waitlist" after
 * submit and Jan picks the 50 beta testers manually from the DB. When
 * the selection logic ships, the API response will set this state.
 */
type SuccessVariant = "beta" | "waitlist";

/**
 * Early-access signup form. UI-only — submit handler logs locally and
 * shows the success state. Backend hookup (Supabase `beta_applications`
 * table + selection logic) is a separate iteration.
 */
export function BetaApplicationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [weeklyCalls, setWeeklyCalls] = useState<WeeklyCalls>("");
  const [selling, setSelling] = useState("");
  const [currentTool, setCurrentTool] = useState<CurrentTool>("");
  const [hasIPhone, setHasIPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [variant, setVariant] = useState<SuccessVariant>("waitlist");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !email || !weeklyCalls || !currentTool || !hasIPhone) return;

    if (typeof window !== "undefined") {
      console.log("[early-access] signup:", {
        name,
        email,
        website,
        weeklyCalls,
        selling,
        currentTool,
        hasIPhone,
      });
    }
    // MVP: always waitlist. Replace with backend response once the
    // selection endpoint exists.
    setVariant("waitlist");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="beta-success">
        <div className="beta-success-icon">
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        {variant === "beta" ? (
          <>
            <h3>You&apos;re in.</h3>
            <p>
              We&apos;ll email you within 24h with next steps, then send your
              TestFlight invite. Welcome to the founding 50.
            </p>
          </>
        ) : (
          <>
            <h3>You&apos;re on the launch list.</h3>
            <p>
              You&apos;ll be among the first to get access when we open
              publicly, with founder pricing locked in for life and a free
              month on us. We&apos;ll be in touch.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="beta-form" onSubmit={handleSubmit}>
      <div className="beta-form-grid">
        <label className="beta-field">
          <span className="beta-field-label">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
        </label>

        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </label>
      </div>

      <label className="beta-field">
        <span className="beta-field-label">
          Your business website{" "}
          <span className="beta-field-optional">(optional)</span>
        </span>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="yourbusiness.com"
        />
        <span className="beta-field-hint">
          Helps us verify you&apos;re an active business owner.
        </span>
      </label>

      <label className="beta-field">
        <span className="beta-field-label">Cold calls you make per week</span>
        <select
          required
          value={weeklyCalls}
          onChange={(e) => setWeeklyCalls(e.target.value as WeeklyCalls)}
        >
          <option value="" disabled>
            Select an answer
          </option>
          <option value="under_10">Under 10, just getting started</option>
          <option value="10_30">10 to 30</option>
          <option value="30_100">30 to 100</option>
          <option value="over_100">Over 100</option>
        </select>
      </label>

      <label className="beta-field">
        <span className="beta-field-label">
          What you sell <span className="beta-field-optional">(optional)</span>
        </span>
        <input
          type="text"
          value={selling}
          onChange={(e) => setSelling(e.target.value)}
          placeholder="e.g. websites, SEO, ads, design, copywriting..."
        />
      </label>

      <label className="beta-field">
        <span className="beta-field-label">
          What you use today for cold calling
        </span>
        <select
          required
          value={currentTool}
          onChange={(e) => setCurrentTool(e.target.value as CurrentTool)}
        >
          <option value="" disabled>
            Select an answer
          </option>
          <option value="nothing">Nothing yet</option>
          <option value="spreadsheet">A spreadsheet</option>
          <option value="crm">A CRM (HubSpot, Pipedrive, Notion, etc.)</option>
          <option value="other">Something else</option>
        </select>
      </label>

      <label className="beta-checkbox">
        <input
          type="checkbox"
          required
          checked={hasIPhone}
          onChange={(e) => setHasIPhone(e.target.checked)}
        />
        <span>
          I have an iPhone with iOS 17 or later
          <span className="beta-checkbox-note">
            TestFlight requires this. Android is not supported in the beta.
          </span>
        </span>
      </label>

      <button
        type="submit"
        className="beta-submit"
        disabled={
          !name || !email || !weeklyCalls || !currentTool || !hasIPhone
        }
      >
        Reserve my spot
      </button>
      <p className="beta-submit-meta">Either way, you&apos;re in.</p>
    </form>
  );
}
