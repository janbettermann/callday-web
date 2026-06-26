"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard Button fuer den Affiliate-Link. 2-Sekunden "Copied!"-
 * Feedback nach erfolgreichem Copy.
 */
export function CopyLinkButton({ link }: { link: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label =
    state === "copied"
      ? "Copied ✓"
      : state === "error"
        ? "Copy failed"
        : "Copy link";

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        background:
          state === "copied"
            ? "rgba(16,185,129,0.1)"
            : "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
        color: state === "copied" ? "#047857" : "#ffffff",
        border: "none",
        borderRadius: 10,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow:
          state === "copied"
            ? "none"
            : "0 6px 18px rgba(37,99,232,0.22)",
        transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
}
