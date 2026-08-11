"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardCallday } from "@/lib/dashboard/data";

export type CopyStatus = "idle" | "busy" | "copied";

const FEEDBACK_MS = 1800;

/** Off-screen Fixed-Width-Sticker (EXPORT_WIDTH via .callday-export-stage =
 *  300px) → PNG-Blob (html-to-image, 4× fuer Schaerfe). Wartet auf geladene
 *  Fonts. Wirft bei Fehler. */
async function stickerBlob(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  if (document.fonts?.ready) await document.fonts.ready;
  const blob = await toBlob(node, { pixelRatio: 4, cacheBust: true });
  if (!blob) throw new Error("sticker capture returned null");
  return blob;
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileName(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `callday-${slug || "sticker"}.png`;
}

/**
 * Copy-Logik der /calldays-Karte: Capture-Quelle ist der off-screen
 * Fixed-300px-Sticker am zurueckgegebenen `exportRef` — so ist der
 * Export ueberall identisch geformt. `status` treibt den gruenen
 * Overlay (siehe ShareableSticker).
 *
 * clipboard.write laeuft synchron im Klick-Gesture (Safari) — der Blob
 * geht als Promise an ClipboardItem. Ohne Image-Clipboard-Support →
 * Download. Der Timer wird beim Unmount + bei jedem neuen Flash sauber
 * gecleart, damit ein zweiter Copy den ersten nicht in ein flackerndes
 * Zwischenrendering wirft.
 */
export function useStickerCopy(day: DashboardCallday) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flashCopied() {
    setStatus("copied");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);
  }

  function copy() {
    if (status !== "idle" || !exportRef.current) return;
    const node = exportRef.current;
    setStatus("busy");

    const canClipboardImage =
      typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

    if (canClipboardImage) {
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": stickerBlob(node) })])
        .then(flashCopied)
        .catch((err) => {
          console.error("[share] copy failed", err);
          setStatus("idle");
        });
    } else {
      stickerBlob(node)
        .then((blob) => {
          triggerDownload(blob, fileName(day.label));
          flashCopied();
        })
        .catch((err) => {
          console.error("[share] save failed", err);
          setStatus("idle");
        });
    }
  }

  return { exportRef, status, copy };
}
