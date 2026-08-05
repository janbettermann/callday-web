"use client";

import { useState } from "react";
import {
  resolveCanonicalCategory,
  searchCategories,
} from "@/lib/lists/gmb-categories";
import {
  CheckBadge,
  SuggestDropdown,
  handleSuggestKeys,
  type SuggestOption,
} from "./suggest";

/**
 * Branchen-Eingabe mit lokalem Autocomplete aus der kuratierten
 * GMB-Kategorienliste (Spec §13d Phase 0b) — gleiche Optik/Bedienung
 * wie City/Country. Freitext bleibt IMMER gueltig (die Outscraper-
 * Query ist Text-Suche); das Haekchen zeigt nur "erkannte Kategorie"
 * und ist pur aus dem Wert abgeleitet, damit auch Chip-Klicks im
 * Parent es korrekt setzen.
 *
 * Seit Generator-v3 (§14b) matcht die Suche auch deutsche Aliase:
 * "Zahnarzt" erscheint mit der Kanonik als Sublabel ("Dentist"). Der
 * Klick laesst den DEUTSCHEN Text im Feld stehen (Anzeige-Sprache,
 * Jan-Entscheidung 2026-08-05) — die englische Kanonik ist jederzeit
 * pur aus dem Text ableitbar (resolveCanonicalCategory) und wird erst
 * beim Submit als Query-Begriff aufgeloest; sie funktioniert in jedem
 * Markt (§6b). Unbekannter Freitext bleibt gueltig — dann ohne
 * Haekchen, Query woertlich.
 */

interface Props {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  /** Null-Tipp-Einstiege (Chips unterm Feld) — kuratierte Starter. */
  suggestions?: string[];
  /** Zeigt den Pflicht-Stern am Label. */
  required?: boolean;
}

export function IndustryAutocomplete({
  value,
  disabled,
  onChange,
  suggestions,
  required,
}: Props) {
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Erkannt = Feldtext loest zu einer Kanonik auf — englischer Name
  // ODER Alias ("Zahnarzt" bleibt sichtbar stehen, die Query laeuft
  // auf "Dentist"; Aufloesung macht der Submit im Parent).
  const canonical = resolveCanonicalCategory(value);
  const recognized = canonical !== null;
  // Kanonik nur anzeigen, wenn sie sich vom Feldtext unterscheidet —
  // "Dentist ✓ Dentist" waere Rauschen.
  const showCanonical =
    canonical !== null &&
    canonical.toLowerCase() !== value.trim().toLowerCase();

  function showMatches(query: string) {
    // CategorySuggestion ist strukturell eine SuggestOption — Alias-
    // Treffer bringen label (Alias) + sublabel (Kanonik) schon mit.
    const matches = searchCategories(query);
    setOptions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
  }

  function handleText(next: string) {
    onChange(next);
    showMatches(next);
  }

  function handlePick(option: SuggestOption) {
    // Anzeige-Sprache: der geklickte LABEL-Text bleibt im Feld stehen
    // ("Zahnarzt"), nicht die Kanonik — die ist ueber
    // resolveCanonicalCategory jederzeit aus dem Text ableitbar.
    onChange(option.label);
    setOpen(false);
    setOptions([]);
  }

  // KEIN umschliessendes <label> — Begruendung siehe CountryAutocomplete
  // (Label-Aktivierung beim Klick auf Dropdown-Vorschlaege).
  return (
    <div className="beta-field">
      <label className="beta-field-label" htmlFor="lists-industry-input">
        {required && <span className="lists-req">* </span>}
        Industry
      </label>
      <div className="lists-suggest-wrap">
        {/* Einrast-Zustand (Design-Variante B, Jan-Entscheidung
            2026-08-05): bei erkannter Kategorie kippt das FELD in den
            gerasteten Look (Brand-Toenung, Text semibold, rechts
            ✓ + Kanonik). Flex-Box statt absolutem Haekchen, damit
            lange Kanonik-Namen nie mit dem Text kollidieren.
            Weitertippen loest den Zustand — reine Wert-Ableitung,
            kein eigener State. */}
        <div
          className={
            "lists-snapfield" +
            (recognized ? " is-snapped" : "") +
            (disabled ? " is-disabled" : "")
          }
        >
          <input
            id="lists-industry-input"
            type="text"
            value={value}
            onChange={(e) => handleText(e.target.value)}
            onFocus={() => {
              // Erkannte Kategorie nicht direkt wieder ueberpinseln —
              // Vorschlaege erst, wenn der Text sich aendert.
              if (!recognized) showMatches(value);
            }}
            onKeyDown={(e) =>
              handleSuggestKeys(e, {
                open,
                options,
                activeIndex,
                setActiveIndex,
                onPick: handlePick,
                onClose: () => setOpen(false),
              })
            }
            onBlur={() => setOpen(false)}
            placeholder="Dentist"
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {recognized && (
            <span className="lists-snap-meta" aria-hidden="true">
              <CheckBadge />
              {showCanonical && (
                <span className="lists-snap-canonical">{canonical}</span>
              )}
            </span>
          )}
        </div>
        {open && (
          <SuggestDropdown
            options={options}
            activeIndex={activeIndex}
            onPick={handlePick}
          />
        )}
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="lists-try" aria-label="Industry examples">
          Examples:
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="lists-try-chip"
              onClick={() => {
                onChange(suggestion);
                setOpen(false);
              }}
              disabled={disabled}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
