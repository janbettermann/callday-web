"use client";

import type { KeyboardEvent } from "react";

/**
 * Geteilte Dropdown-UI + Tastatur-Navigation fuer die Vorschlags-Felder
 * auf /lists (Stadt via Google Places, Land aus lokaler Liste). Die
 * Daten-Beschaffung bleibt bewusst bei den Feldern — hier lebt nur, was
 * wirklich identisch ist: Rendering und Key-Handling.
 */

export interface SuggestOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Vereinheitlichtes Bestaetigungs-Badge der Formular-Felder (Design-
 * Variante B, Jan-Wahl 2026-08-05): Stroke-Check im gruenen Tint-Kreis.
 * SVG statt Text-Glyphe — ✓ als Schriftzeichen rendert je nach
 * Plattform/Gewicht unterschiedlich (bis hin zum Emoji-Look), das SVG
 * ist ueberall identisch.
 */
export function CheckBadge() {
  return (
    <span className="lists-check-badge" aria-hidden="true">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
      </svg>
    </span>
  );
}

/**
 * Geteiltes Clear-X (Chip-Remove + Country-Feld-Clear): crispes SVG-×
 * im App-Look — weiss auf dem gefuellten Grau-Kreis der
 * .lists-loc-chip-x. SVG statt "×"-Zeichen, damit es plattformgleich
 * und so crisp wie der iOS-Clear-Button der App rendert.
 */
export function ClearX() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

interface SuggestDropdownProps {
  options: SuggestOption[];
  activeIndex: number;
  attribution?: string;
  onPick: (option: SuggestOption) => void;
}

export function SuggestDropdown({
  options,
  activeIndex,
  attribution,
  onPick,
}: SuggestDropdownProps) {
  return (
    <div className="lists-suggest-dropdown" role="listbox">
      {options.map((option, index) => (
        <button
          key={`${option.value}-${option.sublabel ?? ""}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={
            "lists-suggest-option" + (index === activeIndex ? " is-active" : "")
          }
          // preventDefault auf mousedown, damit der Input-Blur den Klick
          // nicht wegschnappt (Dropdown schloesse sonst vor dem onClick).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(option)}
        >
          <span className="lists-suggest-option-name">{option.label}</span>
          {option.sublabel && (
            <span className="lists-suggest-option-sub">{option.sublabel}</span>
          )}
        </button>
      ))}
      {attribution && (
        <div className="lists-suggest-attribution">{attribution}</div>
      )}
    </div>
  );
}

interface SuggestKeyContext {
  open: boolean;
  options: SuggestOption[];
  activeIndex: number;
  setActiveIndex: (updater: (index: number) => number) => void;
  onPick: (option: SuggestOption) => void;
  onClose: () => void;
}

/**
 * Pfeiltasten navigieren, Enter uebernimmt den markierten (sonst
 * obersten) Vorschlag statt das Formular abzuschicken, Escape schliesst.
 */
export function handleSuggestKeys(
  event: KeyboardEvent<HTMLInputElement>,
  ctx: SuggestKeyContext,
): void {
  if (event.key === "Escape") {
    ctx.onClose();
    return;
  }
  if (!ctx.open || ctx.options.length === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    ctx.setActiveIndex((i) => Math.min(i + 1, ctx.options.length - 1));
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    ctx.setActiveIndex((i) => Math.max(i - 1, 0));
  } else if (event.key === "Enter") {
    event.preventDefault();
    ctx.onPick(ctx.options[ctx.activeIndex >= 0 ? ctx.activeIndex : 0]);
  }
}
