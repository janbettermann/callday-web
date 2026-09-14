"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { addAffiliatePostAction, type AddPostState } from "./actions";

/**
 * "Add post"-Formular. Ein Affiliate traegt Link + Zeitpunkt (+ optional
 * Plattform) ein.
 *
 * `datetime-local` liefert Wall-Clock ohne Zone: wir rechnen im Browser in
 * UTC-ISO um (der Browser interpretiert den Wert als lokale Zeit) und
 * senden das als `posted_at`. Auf dem Server (UTC) waere `new Date(local)`
 * sonst um den User-Offset verschoben.
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

  // Nach erfolgreichem Anlegen Felder leeren (revalidate rendert die Liste
  // neu) und den Aufrufer informieren (der Composer schliesst das Modal).
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPostedLocal("");
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="wb-stack" style={{ gap: 14 }}>
      <input type="hidden" name="type" value={type} />

      <div>
        <span className="wb-label">Type</span>
        <div className="wb-seg" role="group" aria-label="Type">
          {(["post", "story"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`wb-seg-item${type === t ? " is-active" : ""}`}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {t === "post" ? "Post" : "Story"}
            </button>
          ))}
        </div>
      </div>

      <label className="wb-field">
        <span className="wb-label">{type === "story" ? "Post link (optional)" : "Post link"}</span>
        <input
          type="url"
          name="url"
          required={type === "post"}
          placeholder={type === "story" ? "Optional, story links expire anyway" : "https://instagram.com/p/…"}
          className="wb-input"
        />
      </label>

      <div className="wb-field-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label className="wb-field">
          <span className="wb-label">Posted at</span>
          <input
            type="datetime-local"
            required
            value={postedLocal}
            onChange={(e) => setPostedLocal(e.target.value)}
            className="wb-input"
            style={{ minWidth: 0, maxWidth: "100%" }}
          />
          <input type="hidden" name="posted_at" value={postedIso} />
        </label>
        <label className="wb-field">
          <span className="wb-label">Platform</span>
          <select name="platform" defaultValue="" className="wb-select">
            <option value="">Optional</option>
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>X / Twitter</option>
            <option>LinkedIn</option>
            <option>Other</option>
          </select>
        </label>
      </div>

      {state?.error ? <p className="wb-msg-error">{state.error}</p> : null}
      {state?.ok ? <p className="wb-msg-ok">Post added.</p> : null}

      <button type="submit" disabled={pending} className="wb-btn-primary" style={{ width: "100%" }}>
        {pending ? "Adding…" : "Add post"}
      </button>
    </form>
  );
}
