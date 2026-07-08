"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { addAffiliatePostAction, type AddPostState } from "./actions";

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "var(--ink-faint)",
  marginBottom: 6,
  display: "block",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  // datetime-local ignoriert width:100% auf iOS/WebKit sonst und laeuft aus
  // dem Slide-up raus — minWidth:0 + maxWidth:100% baendigt die intrinsische
  // Feldbreite. Gilt fuer alle Felder (harmlos fuer url/select).
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "rgba(26,29,38,0.045)",
  border: "1px solid transparent",
  borderRadius: 12,
  padding: "12px 14px",
  // 16px verhindert iOS-Safari-Auto-Zoom beim Fokussieren (Felder <16px
  // zoomen sonst rein). NICHT ueber user-scalable=no loesen (Accessibility).
  fontSize: 16,
  fontFamily: "inherit",
  color: "var(--ink)",
};

/**
 * "Add post"-Formular im Affiliate-Dashboard. Ein Affiliate traegt Link +
 * Zeitpunkt (+ optional Plattform) ein.
 *
 * `datetime-local` liefert Wall-Clock ohne Zone — wir rechnen im Browser in
 * UTC-ISO um (der Browser interpretiert den Wert als lokale Zeit) und senden
 * das als `posted_at`. Auf dem Server (UTC) waere `new Date(local)` sonst um
 * den User-Offset verschoben.
 */
export function AddPostForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [state, formAction, pending] = useActionState<AddPostState, FormData>(
    addAffiliatePostAction,
    null,
  );
  const [postedLocal, setPostedLocal] = useState("");
  const [type, setType] = useState<"post" | "story">("post");
  const postedIso = postedLocal ? new Date(postedLocal).toISOString() : "";
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Anlegen Felder leeren (revalidate rendert die Liste neu)
  // und den Aufrufer informieren (der Composer schliesst dann das Overlay).
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPostedLocal("");
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <input type="hidden" name="type" value={type} />
      <div>
        <label style={labelStyle}>Type</label>
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "rgba(26,29,38,0.045)",
            borderRadius: 12,
            padding: 4,
          }}
        >
          {(["post", "story"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              style={{
                flex: 1,
                borderRadius: 9,
                border: "none",
                padding: "8px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                background: type === t ? "#ffffff" : "transparent",
                color: type === t ? "var(--ink)" : "var(--ink-dim)",
                boxShadow:
                  type === t ? "0 1px 2px rgba(26,29,38,0.12)" : "none",
              }}
            >
              {t === "post" ? "Post" : "Story"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="post-url">
          {type === "story" ? "Post link (optional)" : "Post link"}
        </label>
        <input
          id="post-url"
          type="url"
          name="url"
          required={type === "post"}
          placeholder={
            type === "story"
              ? "Optional — story links expire anyway"
              : "https://instagram.com/p/…"
          }
          style={fieldStyle}
        />
      </div>

      <div className="pc-fields">
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle} htmlFor="post-when">
            Posted at
          </label>
          <input
            id="post-when"
            type="datetime-local"
            required
            value={postedLocal}
            onChange={(e) => setPostedLocal(e.target.value)}
            className="pc-datetime"
            style={fieldStyle}
          />
          <input type="hidden" name="posted_at" value={postedIso} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle} htmlFor="post-platform">
            Platform
          </label>
          <select
            id="post-platform"
            name="platform"
            defaultValue=""
            style={fieldStyle}
          >
            <option value="">Optional</option>
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>X / Twitter</option>
            <option>LinkedIn</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      {state?.error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p style={{ margin: 0, fontSize: 13, color: "#047857" }}>
          Post added ✓
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        style={{
          alignSelf: "stretch",
          background:
            "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
          color: "#ffffff",
          border: "none",
          borderRadius: 12,
          padding: "13px 20px",
          fontSize: 15,
          fontWeight: 600,
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
          boxShadow: "0 6px 18px rgba(37,99,232,0.22)",
        }}
      >
        {pending ? "Adding…" : "Add post"}
      </button>
    </form>
  );
}
