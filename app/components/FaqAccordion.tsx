"use client";

import { useState, type ReactNode } from "react";
import { useIsLoggedIn } from "@/lib/use-is-logged-in";

type FaqItem = {
  q: string;
  a: ReactNode;
  // Fuer eingeloggte Rueckkehrer ausblenden (sie haben sich schon
  // registriert — die Frage ist dann irrelevant).
  hideWhenLoggedIn?: boolean;
};

const ITEMS: FaqItem[] = [
  {
    q: "What happens after I sign up?",
    a: (
      <>
        <p>
          Confirm your account and the download link for the Callday app
          lands in your inbox right away, sent from{" "}
          <strong>hello@callday.io</strong>. Install the app and sign in
          with the same account.
        </p>
        <p>If you don&apos;t see the email, check spam.</p>
      </>
    ),
    hideWhenLoggedIn: true,
  },
  {
    q: "How much does Callday cost?",
    a: (
      <p>
        Callday is $14.99 per month or $119 per year, after a 14-day
        free trial. Signing up and building your first lead list is
        free — no credit card required.
      </p>
    ),
  },
  {
    q: "Where do I get a lead list?",
    a: (
      <>
        <p>
          Callday builds it for you: pick an industry and a city, and
          you get a call-ready list — phone numbers, websites, ratings.
          Your first list is free.
        </p>
        <p>
          Already have leads? Any CSV or Excel file imports in under a
          minute.
        </p>
      </>
    ),
  },
];

/**
 * FAQ accordion for the landing page.
 *
 * Single-open-at-a-time. Alle Fragen starten GESCHLOSSEN (Jan
 * 2026-07-23 — vorher war die erste offen, damit der Block als
 * Accordion erkennbar ist; die Chevron-Icons leisten das inzwischen).
 *
 * Expansion uses the `grid-template-rows: 0fr → 1fr` trick so the height
 * animates without measuring the answer in JS. Answers stay in the DOM
 * when collapsed (clipped via `overflow: hidden`) so the height
 * transition has a stable start/end value; `aria-hidden` keeps them out
 * of the screen-reader's flow.
 */
export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Eingeloggte Rueckkehrer sehen die hideWhenLoggedIn-Fragen nicht
  // ("What happens after I sign up?" ist fuer sie erledigt).
  const loggedIn = useIsLoggedIn();
  const items = loggedIn ? ITEMS.filter((it) => !it.hideWhenLoggedIn) : ITEMS;

  return (
    <ul className="faq-list">
      {items.map((item, i) => {
        const isOpen = i === openIndex;
        return (
          <li key={item.q} className="faq-item" data-open={isOpen || undefined}>
            <button
              type="button"
              className="faq-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className="faq-question">{item.q}</span>
              <span className="faq-icon" aria-hidden>
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div className="faq-answer-wrap" aria-hidden={!isOpen}>
              <div className="faq-answer">
                <div className="faq-answer-inner">{item.a}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
