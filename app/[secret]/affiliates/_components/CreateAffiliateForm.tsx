"use client";

import { useState, useTransition, type FormEvent } from "react";

import { createAffiliateAction } from "../actions";

/**
 * Inline-Formular zum Anlegen eines Affiliates. Liegt im Werkbank-Panel
 * der Seite (WbPanel padded), bringt also keine eigene Karte mit.
 */

export function CreateAffiliateForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createAffiliateAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const slug = String(formData.get("slug") ?? "");
      setSuccess(`${slug} angelegt. Zeile öffnen, um die Welcome-Mail zu senden.`);
      form.reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="wb-field-grid">
        <Field label="Slug" hint="Kleinbuchstaben, Bindestriche ok, 2 bis 30 Zeichen">
          <input
            name="slug"
            required
            placeholder="joe"
            autoComplete="off"
            className="wb-input"
            style={{ fontFamily: "var(--wb-mono)" }}
          />
        </Field>
        <Field label="Name">
          <input name="name" required placeholder="Joe Bautista" autoComplete="off" className="wb-input" />
        </Field>
        <Field label="E-Mail">
          <input name="email" type="email" required placeholder="joe@example.com" autoComplete="off" className="wb-input" />
        </Field>
        <Field label="Notizen" hint="Cohort-Tag, Kontext, optional">
          <input name="notes" placeholder="Twitter-Outreach, Cold-Caller-Cohort" autoComplete="off" className="wb-input" />
        </Field>
      </div>

      <label className="wb-check">
        <input type="checkbox" name="founder_tier" defaultChecked />
        Founding-Affiliate (erste rund 20 bis 30)
      </label>

      <div className="wb-form-row">
        <div style={{ fontSize: 13, minHeight: 20, flex: 1 }}>
          {error ? (
            <span className="wb-msg-error">{error}</span>
          ) : success ? (
            <span className="wb-msg-ok">{success}</span>
          ) : (
            <span style={{ color: "var(--wb-ink-3)" }}>
              Der Slug wird <code>callday.io/a/[slug]</code> und bleibt danach fest.
            </span>
          )}
        </div>
        <button type="submit" disabled={isPending} aria-busy={isPending} className="wb-btn-primary is-small">
          {isPending ? "Wird angelegt…" : "Affiliate anlegen"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="wb-field">
      <span className="wb-label">{label}</span>
      {children}
      {hint ? <div className="wb-hint">{hint}</div> : null}
    </label>
  );
}
