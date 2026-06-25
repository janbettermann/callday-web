"use client";

import { useState, type ReactNode } from "react";

type FaqItem = {
  q: string;
  a: ReactNode;
};

const ITEMS: FaqItem[] = [
  {
    q: "What happens after I submit?",
    a: (
      <>
        <p>
          Check your inbox. We just sent your TestFlight invite from{" "}
          <strong>hello@callday.io</strong>. Tap the install button on
          your iPhone and the Callday app is on your phone within a
          minute.
        </p>
        <p>If you don&apos;t see the email, check spam.</p>
      </>
    ),
  },
  {
    q: "Is the beta really free?",
    a: (
      <p>
        Yes. No credit card, no charge. We only want you to use the app
        and give us honest feedback.
      </p>
    ),
  },
  {
    q: "How does TestFlight work?",
    a: (
      <p>
        TestFlight is Apple&apos;s official beta-testing app. You need an
        iPhone with iOS 17 or later. Install TestFlight from the App
        Store, tap the invite link from our email, and Callday installs
        from there (like any other regular app).
      </p>
    ),
  },
];

/**
 * FAQ accordion for the landing page.
 *
 * Single-open-at-a-time. First item starts expanded so the visitor sees
 * what kind of block this is at a glance (and doesn't mistake the list
 * of questions for static body copy).
 *
 * Expansion uses the `grid-template-rows: 0fr → 1fr` trick so the height
 * animates without measuring the answer in JS. Answers stay in the DOM
 * when collapsed (clipped via `overflow: hidden`) so the height
 * transition has a stable start/end value; `aria-hidden` keeps them out
 * of the screen-reader's flow.
 */
export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ul className="faq-list">
      {ITEMS.map((item, i) => {
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
