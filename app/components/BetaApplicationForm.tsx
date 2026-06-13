"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type WeeklyCalls = "" | "under_10" | "10_30" | "30_100" | "over_100";
type CurrentTool = "" | "nothing" | "spreadsheet" | "crm" | "other";

type SubmitStatus = "idle" | "submitting" | "error";

/**
 * Beta-Application-Form. Submitted via /api/beta/apply — die Route schreibt
 * eine Zeile in public.applications (status='pending') und sendet die
 * Bestätigungsmail.
 *
 * Nach erfolgreichem Submit navigiert das Form auf /beta/applied (dedicated
 * Confirmation-Page). Bei Duplikat geht's auf /beta/applied?status=duplicate
 * mit expliziter "we've got you already"-Message — siehe UX-Entscheidung
 * 2026-06-06: Email-Enumeration-Protection ist für eine Beta-Waitlist
 * weniger wert als klare Kommunikation.
 *
 * Tonalitaets-Vorgabe der Confirmation-Mail (siehe emails/application-
 * confirmation.tsx + BETA_WORKFLOW_PLAN.md Template 1): erste Mail preempted
 * KEINE Selektions-Entscheidung — nur 48h-Review + Founder-Spot-Garantie.
 */
export function BetaApplicationForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [weeklyCalls, setWeeklyCalls] = useState<WeeklyCalls>("");
  const [currentTool, setCurrentTool] = useState<CurrentTool>("");
  const [currentToolOther, setCurrentToolOther] = useState("");
  const [hasIPhone, setHasIPhone] = useState(false);

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // "other" + Freitext muss befüllt sein, sonst zählt das Form als unvollständig
  const otherNeedsText = currentTool === "other";
  const otherTextOk = !otherNeedsText || currentToolOther.trim().length > 0;
  const isComplete =
    Boolean(name) &&
    Boolean(email) &&
    Boolean(weeklyCalls) &&
    Boolean(currentTool) &&
    otherTextOk &&
    hasIPhone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || status === "submitting") return;

    setStatus("submitting");
    setErrorMessage(null);

    // current_tool: bei "other" speichern wir den Freitext direkt
    // (DB-Feld ist TEXT, akzeptiert Enum-Wert oder Freitext)
    const resolvedCurrentTool =
      currentTool === "other" ? currentToolOther.trim() : currentTool;

    try {
      const response = await fetch("/api/beta/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          cold_calls_per_week: weeklyCalls,
          current_tool: resolvedCurrentTool,
          has_ios17: hasIPhone,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        duplicate?: boolean;
        error?: string;
      };

      if (response.ok && data.success) {
        router.push(
          data.duplicate ? "/beta/applied?status=duplicate" : "/beta/applied",
        );
        return;
      }

      setStatus("error");
      setErrorMessage(
        data.error ??
          "Something went wrong on our end. Please try again in a minute.",
      );
    } catch {
      setStatus("error");
      setErrorMessage(
        "We couldn't reach our servers. Check your connection and try again.",
      );
    }
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
            disabled={status === "submitting"}
          />
          {/* Helper-Text VOR dem Tippen: erklaert die LinkedIn-Match-Regel
              kurz und an der Stelle wo die Entscheidung faellt. Die warme
              Begruendung sitzt unten am Submit (beta-submit-note). */}
          <span className="beta-field-help">
            Please match your LinkedIn name.
          </span>
        </label>

        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "submitting"}
          />
        </label>
      </div>

      <label className="beta-field">
        <span className="beta-field-label">Cold calls you make per week</span>
        <select
          required
          value={weeklyCalls}
          onChange={(e) => setWeeklyCalls(e.target.value as WeeklyCalls)}
          disabled={status === "submitting"}
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
          What you use today for cold calling
        </span>
        <select
          required
          value={currentTool}
          onChange={(e) => {
            const next = e.target.value as CurrentTool;
            setCurrentTool(next);
            if (next !== "other") setCurrentToolOther("");
          }}
          disabled={status === "submitting"}
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

      {currentTool === "other" && (
        <label className="beta-field">
          <span className="beta-field-label">Which tool?</span>
          <input
            type="text"
            required
            value={currentToolOther}
            onChange={(e) => setCurrentToolOther(e.target.value)}
            placeholder="e.g. Notion, paper notebook, custom Airtable..."
            disabled={status === "submitting"}
          />
        </label>
      )}

      <label className="beta-checkbox">
        <input
          type="checkbox"
          required
          checked={hasIPhone}
          onChange={(e) => setHasIPhone(e.target.checked)}
          disabled={status === "submitting"}
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
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Sending..." : "Save my spot"}
      </button>

      {/* Trust-Strip unter dem CTA: erklaert das Warum hinter der LinkedIn-
          Match-Regel als warmes Promise statt nuechterner Instruction. */}
      <p className="beta-submit-note">
        We&apos;ll connect on LinkedIn to ping you for feedback in 2-3 weeks.
        That&apos;s it.
      </p>

      {status === "error" && errorMessage && (
        <p className="beta-submit-error" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
