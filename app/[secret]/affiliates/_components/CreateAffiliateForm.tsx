"use client";

import { useState, useTransition, type FormEvent } from "react";

import { createAffiliateAction } from "../actions";

/**
 * Inline-Create-Form mit Brand-Aesthetik (cream-bg-page, form-card-style
 * white panel, beta-field-Inputs, brand-blue Primary-Button).
 */

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid var(--line)",
  borderRadius: 24,
  padding: "28px 28px 24px",
  boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
};

const fieldRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(26, 29, 38, 0.045)",
  border: "1px solid transparent",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-dim)",
  letterSpacing: 0.2,
  marginBottom: 6,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-faint)",
  marginTop: 4,
  fontWeight: 400,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow:
    "0 6px 18px rgba(37,99,232,0.22), 0 2px 6px rgba(74,122,247,0.18)",
  transition: "transform 0.15s, opacity 0.15s",
};

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
      setSuccess(
        `Created ${slug}. Open the row to send the welcome mail.`,
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle} noValidate>
      <div style={fieldRowStyle}>
        <Field label="Slug" hint="lowercase · dashes ok · 2–30 chars">
          <input
            name="slug"
            required
            placeholder="joe"
            autoComplete="off"
            style={{
              ...inputBaseStyle,
              fontFamily: "var(--font-mono), monospace",
            }}
          />
        </Field>

        <Field label="Name">
          <input
            name="name"
            required
            placeholder="Joe Bautista"
            autoComplete="off"
            style={inputBaseStyle}
          />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            placeholder="joe@example.com"
            autoComplete="off"
            style={inputBaseStyle}
          />
        </Field>

        <Field label="Notes" hint="cohort tag · intro context · optional">
          <input
            name="notes"
            placeholder="Twitter outreach · cold caller cohort"
            autoComplete="off"
            style={inputBaseStyle}
          />
        </Field>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "var(--ink-dim)",
          cursor: "pointer",
          marginBottom: 22,
        }}
      >
        <input
          type="checkbox"
          name="founder_tier"
          defaultChecked
          style={{ width: 16, height: 16, accentColor: "var(--blue-deep)" }}
        />
        Founding affiliate (first ~20–30 cohort)
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 14, minHeight: 20, flex: 1 }}>
          {error ? (
            <span style={{ color: "#b91c1c" }}>{error}</span>
          ) : success ? (
            <span style={{ color: "#15803d" }}>{success}</span>
          ) : (
            <span style={{ color: "var(--ink-faint)" }}>
              Slug becomes <code style={{ fontFamily: "var(--font-mono), monospace" }}>callday.io/a/[slug]</code> — make it stable.
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          style={{
            ...primaryButtonStyle,
            opacity: isPending ? 0.7 : 1,
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending ? "Creating…" : "Create affiliate"}
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
    <label style={{ display: "block" }}>
      <div style={labelStyle}>{label}</div>
      {children}
      {hint ? <div style={hintStyle}>{hint}</div> : null}
    </label>
  );
}
