"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { requestMagicLinkAction } from "./actions";

/**
 * Email-Form fuer das Affiliate-Magic-Link-Login. Submit triggert
 * Server-Action requestMagicLinkAction. Bei success navigieren wir zu
 * /affiliate/login?sent=<email> → die Page rendert dann den SentCard.
 *
 * Note: noValidate + Custom-Validation-Message-Pattern (analog zur
 * SignupForm) — Button immer klickbar, Hint bei leerem Feld.
 */

interface Props {
  presetEmail: string;
  initialError: string | null;
}

export function LoginForm({ presetEmail, initialError }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(presetEmail);
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }

    const formData = new FormData();
    formData.set("email", trimmed);

    startTransition(async () => {
      const result = await requestMagicLinkAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push(
        `/affiliate/login?sent=${encodeURIComponent(result.email ?? trimmed)}`,
      );
    });
  }

  return (
    <div className="login-card">
      <h1 className="login-headline">Affiliate sign-in</h1>
      <p className="login-sub">
        Enter your email — we&apos;ll send you a sign-in link.
      </p>

      <form className="beta-form" onSubmit={handleSubmit} noValidate>
        <label className="beta-field">
          <span className="beta-field-label">Email</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isPending}
          />
        </label>

        <button
          type="submit"
          className="beta-submit"
          aria-busy={isPending}
          disabled={isPending}
        >
          {isPending ? "Sending…" : "Send sign-in link"}
        </button>

        {error ? (
          <p className="beta-submit-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
