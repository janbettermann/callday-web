"use client";

import { useState } from "react";
import {
  isKnownCategory,
  searchCategories,
} from "@/lib/lists/gmb-categories";
import {
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
 */

interface Props {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  /** Null-Tipp-Einstiege (Chips unterm Feld) — kuratierte Starter. */
  suggestions?: string[];
}

export function IndustryAutocomplete({
  value,
  disabled,
  onChange,
  suggestions,
}: Props) {
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const recognized = isKnownCategory(value);

  function showMatches(query: string) {
    const matches = searchCategories(query).map((category) => ({
      value: category,
      label: category,
    }));
    setOptions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
  }

  function handleText(next: string) {
    onChange(next);
    showMatches(next);
  }

  function handlePick(option: SuggestOption) {
    onChange(option.value);
    setOpen(false);
    setOptions([]);
  }

  // KEIN umschliessendes <label> — Begruendung siehe CountryAutocomplete
  // (Label-Aktivierung beim Klick auf Dropdown-Vorschlaege).
  return (
    <div className="beta-field">
      <label className="beta-field-label" htmlFor="lists-industry-input">
        Industry
      </label>
      <div className="lists-suggest-wrap">
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
          style={recognized ? { paddingRight: 44 } : undefined}
        />
        {recognized && (
          <span className="lists-suggest-check" aria-hidden="true">
            ✓
          </span>
        )}
        {open && (
          <SuggestDropdown
            options={options}
            activeIndex={activeIndex}
            onPick={handlePick}
          />
        )}
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="lists-chip-row" aria-label="Industry suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="lists-chip"
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
