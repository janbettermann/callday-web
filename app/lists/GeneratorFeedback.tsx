"use client";

import { useState, useTransition } from "react";
import {
  submitGeneratorFeedback,
  type GeneratorFeedbackCategory,
} from "./actions";

/**
 * Feedback-Kanal des "New"-Features unterm Generator-Titel: eine leise
 * Zeile ("results vary by area") mit dem Text-Link "Tell us how it went".
 * Klick klappt die Box auf — Anliegen waehlen (Bug / Idea, Kachel-Grammatik
 * der App-Feedback-Seite), Text, Send. Nach dem Senden bleibt ein Danke
 * stehen, bis die Seite neu laedt.
 *
 * Lebt INNERHALB des Generator-<form> (der Titel wohnt in der Card) —
 * deshalb ueberall type="button" und kein eigenes <form>, sonst wuerde
 * Enter/Klick die Listen-Generierung ausloesen.
 */

const CATEGORIES: Array<{
  value: GeneratorFeedbackCategory;
  label: string;
  sub: string;
  placeholder: string;
}> = [
  {
    value: "bug",
    label: "Bug",
    sub: "Something's off",
    placeholder: "What went wrong? Wrong numbers, missing businesses, an error…",
  },
  {
    value: "idea",
    label: "Idea",
    sub: "Wish it could…",
    placeholder: "What would make the generator more useful for you?",
  },
];

export function GeneratorFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<GeneratorFeedbackCategory>("idea");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[1];

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitGeneratorFeedback(category, text);
      if (result.ok) {
        setSent(true);
        return;
      }
      setError(
        result.error === "empty"
          ? "Write a line first — even a short one helps."
          : "Couldn't send that. Please try again.",
      );
    });
  };

  if (sent) {
    return (
      <p className="lists-feedback-thanks" role="status">
        Thanks — we read every one.
      </p>
    );
  }

  return (
    <div className="lists-feedback">
      <p className="lists-feedback-lead">
        New feature — results vary by area.{" "}
        <button
          type="button"
          className="lists-feedback-trigger"
          aria-expanded={open}
          aria-controls="lists-feedback-form"
          onClick={() => setOpen((v) => !v)}
        >
          Tell us how it went
        </button>
      </p>
      {open && (
        <div id="lists-feedback-form" className="lists-feedback-form">
          <div
            className="lists-feedback-cats"
            role="radiogroup"
            aria-label="What is it about"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={category === c.value}
                className={
                  "lists-feedback-cat" +
                  (category === c.value ? " is-active" : "")
                }
                onClick={() => setCategory(c.value)}
              >
                <span className="lists-feedback-cat-label">{c.label}</span>
                <span className="lists-feedback-cat-sub">{c.sub}</span>
              </button>
            ))}
          </div>
          <textarea
            className="lists-feedback-text"
            rows={3}
            maxLength={2000}
            placeholder={active.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Your feedback"
          />
          {error && (
            <p className="lists-feedback-error" role="alert">
              {error}
            </p>
          )}
          <div className="lists-feedback-actions">
            <button
              type="button"
              className="lists-feedback-send"
              disabled={pending}
              onClick={send}
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
