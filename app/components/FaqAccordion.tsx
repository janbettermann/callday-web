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
      <p>
        We&apos;ll email you within 48 hours with next steps. Once
        you&apos;re confirmed, we send your TestFlight invite, usually
        within an hour. From there, you can install Callday and start using
        it the same day.
      </p>
    ),
  },
  {
    q: "Is the beta really free?",
    a: (
      <>
        <p>
          Yes. Free for the full beta period. No credit card, no hidden charge,
          no upgrade prompt.
        </p>
        <p>
          The only thing we ask. Actually use the app for real cold calls, and
          tell us what&apos;s broken or confusing.
        </p>
      </>
    ),
  },
  {
    q: "What's “founder pricing” and how do I get it?",
    a: (
      <>
        <p>
          When Callday launches publicly, everyone who signed up early gets
          an email with a personal founder code. You enter the code when you
          sign up. No expiry. As long as your subscription is active, your
          founder rate stays.
        </p>
        <p>
          Standard pricing at launch is €14/mo. With your founder
          code, that drops to €7/mo for life. It stays at €7 even when we raise
          prices later. The first month is on us either way.
        </p>
      </>
    ),
  },
  {
    q: "What do beta testers actually do?",
    a: (
      <>
        <p>Use the app for actual cold calls. That&apos;s it.</p>
        <p>
          About a week in, we&apos;ll email you to ask how it&apos;s going. If
          something feels broken or wrong, you tell us. No surveys, no
          scheduled meetings, no homework.
        </p>
      </>
    ),
  },
  {
    q: "How does TestFlight work?",
    a: (
      <>
        <p>
          TestFlight is Apple&apos;s official beta-testing tool. You need an
          iPhone with iOS 17 or later.
        </p>
        <p>
          After we confirm your application, we send a TestFlight invite link
          by email. You install the TestFlight app, tap the link, and Callday
          installs like any normal app. Updates arrive automatically.
        </p>
        <p>
          Android isn&apos;t supported in the beta. We&apos;re focused on iOS
          first.
        </p>
      </>
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
