"use client";

import { useState, useTransition, type FormEvent } from "react";

import { createAffiliateAction } from "../actions";

/**
 * Inline-Create-Form auf der Affiliates-Liste. Bewusst expanded-by-default
 * statt versteckt — der haeufigste Use-Case ist "neuen Affiliate anlegen".
 *
 * Slug + Name + Email sind required. Founder-Tier ist Toggle (Plan-Default
 * = ersten 20-30 = Founding, danach Cap geschlossen). Notes ist frei
 * fuer Cohort-Tags wie "kennt Sarah" oder "Twitter outreach".
 *
 * Nach erfolgreichem Create resetten wir das Form und revalidatePath im
 * Server-Action triggert frischen Render der Liste.
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
      setSuccess(`Created ${slug}. Use the row's "Send invite" to email them.`);
      form.reset();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#1a1d26]/[0.06] bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">
          New affiliate
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[1.2px] text-[#1a1d26]/40">
          callday.io/a/[slug]
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Slug" hint="lowercase, dashes ok, 2–30 chars">
          <input
            name="slug"
            required
            placeholder="joe"
            autoComplete="off"
            className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm font-mono outline-none focus:border-[#4a7af7] focus:bg-white"
          />
        </Field>

        <Field label="Name">
          <input
            name="name"
            required
            placeholder="Joe Bautista"
            autoComplete="off"
            className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
          />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            placeholder="joe@example.com"
            autoComplete="off"
            className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
          />
        </Field>

        <Field label="Notes (optional)" hint="Cohort tag, intro context">
          <input
            name="notes"
            placeholder="Twitter outreach · cold caller cohort"
            autoComplete="off"
            className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2 text-sm outline-none focus:border-[#4a7af7] focus:bg-white"
          />
        </Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[#1a1d26]/70">
        <input
          type="checkbox"
          name="founder_tier"
          defaultChecked
          className="h-4 w-4 rounded border-[#1a1d26]/30"
        />
        Founding affiliate (first ~20–30 cohort)
      </label>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-h-[20px] text-sm">
          {error ? (
            <span className="text-[#dc2626]">{error}</span>
          ) : success ? (
            <span className="text-[#16a34a]">{success}</span>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="rounded-lg bg-[#3564e0] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2b56c4] disabled:cursor-wait disabled:opacity-70"
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
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#1a1d26]/65">
        {label}
        {hint ? (
          <span className="ml-2 font-normal text-[#1a1d26]/35">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
