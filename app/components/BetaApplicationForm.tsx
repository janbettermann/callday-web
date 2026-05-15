"use client";

import { useState, type FormEvent } from "react";

type WeeklyCalls = "" | "under_10" | "10_30" | "30_100" | "over_100";
type CurrentTool = "" | "crm" | "spreadsheet" | "nothing" | "other";

/**
 * Beta application form for the first 50 testers.
 * UI-only — submit handler logs locally and shows the success state.
 * Backend hookup (Supabase `beta_applications` table) is a separate iteration.
 */
export function BetaApplicationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [weeklyCalls, setWeeklyCalls] = useState<WeeklyCalls>("");
  const [selling, setSelling] = useState("");
  const [currentTool, setCurrentTool] = useState<CurrentTool>("");
  const [hasIPhone, setHasIPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !email || !weeklyCalls || !currentTool || !hasIPhone) return;

    if (typeof window !== "undefined") {
      console.log("[beta] application:", {
        name,
        email,
        weeklyCalls,
        selling,
        currentTool,
        hasIPhone,
      });
    }
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
        <h3>Application received.</h3>
        <p>
          We&apos;re reviewing applications as they come in. If you&apos;re
          one of the first 50, you&apos;ll get a TestFlight invite by email
          within 48 hours.
        </p>
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
        <span className="beta-field-label">Cold calls you make per week</span>
        <select
          required
          value={weeklyCalls}
          onChange={(e) => setWeeklyCalls(e.target.value as WeeklyCalls)}
        >
          <option value="" disabled>
            Select an answer
          </option>
          <option value="under_10">Under 10 — just getting started</option>
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
            TestFlight requires this — Android is not supported in the beta.
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
        Apply for a beta spot
      </button>
    </form>
  );
}
