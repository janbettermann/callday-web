"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard fuer den Affiliate-Link, 2 Sekunden Bestaetigung.
 */
export function CopyLinkButton({ link }: { link: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const label = state === "copied" ? "Copied" : state === "error" ? "Copy failed" : "Copy link";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={state === "copied" ? "wb-btn is-ok" : "wb-btn-primary is-small"}
    >
      {label}
    </button>
  );
}
