"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { requestMagicLinkAction } from "./actions";

/**
 * E-Mail-Formular fuer das Affiliate-Magic-Link-Login. Submit triggert die
 * Server-Action requestMagicLinkAction; bei Erfolg navigieren wir zu
 * /affiliate/login?sent=<email>, die Page rendert dann die Bestaetigung.
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
      router.push(`/affiliate/login?sent=${encodeURIComponent(result.email ?? trimmed)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="wb-login-title">Sign in</h1>
      <p style={{ fontSize: 13, color: "var(--wb-ink-2)", marginTop: -12, marginBottom: 18, lineHeight: 1.5 }}>
        Enter your email and we&apos;ll send you a sign-in link.
      </p>

      <label className="wb-label" htmlFor="affiliate-email">
        Email
      </label>
      <input
        id="affiliate-email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={isPending}
        className="wb-input"
      />

      {error ? (
        <p className="wb-error-text" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="wb-btn-primary"
        style={{ width: "100%", marginTop: 18 }}
        aria-busy={isPending}
        disabled={isPending}
      >
        {isPending ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
