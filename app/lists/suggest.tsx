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
