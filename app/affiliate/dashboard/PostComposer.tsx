"use client";

import { useState } from "react";

import { WbModal } from "@/app/components/werkbank-modal";
import { AddPostForm } from "./AddPostForm";

/**
 * "Add post"-Button, der das Eingabeformular als Modal oeffnet (Desktop
 * zentriert, Mobile Bottom-Sheet, siehe WbModal). Schliesst nach
 * erfolgreichem Anlegen (onSuccess aus AddPostForm).
 */
export function PostComposer({ windowHours }: { windowHours: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="wb-btn-primary is-small">
        Add post
      </button>

      <WbModal open={open} onClose={() => setOpen(false)} title="Add a post">
        <p style={{ fontSize: 13, color: "var(--wb-ink-2)", lineHeight: 1.5, marginBottom: 16 }}>
          Log a post to see how many visitors and sign-ups came in the {windowHours} h after it.
        </p>
        <AddPostForm onSuccess={() => setOpen(false)} />
      </WbModal>
    </>
  );
}
