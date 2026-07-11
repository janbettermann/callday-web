"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/**
 * Staedte-Eingabe mit Google-Places-Vorschlaegen (via Proxy-Route
 * /api/lists/cities, gefiltert auf das gewaehlte Land).
 *
 * Auswahl aus der Liste "rastet ein" (Haekchen = die Stadt ist
 * eindeutig verstanden) und liefert den kanonischen Ortsnamen — wichtig
 * fuer die City-first-Sortierung der Pipeline (Adressen sagen "Köln",
 * nicht "Cologne"). Freitext bleibt erlaubt: faellt Google aus oder
 * tippt jemand ein Dorf, das nicht vorgeschlagen wird, funktioniert der
 * Generator trotzdem — dann ohne Haekchen.
 */

interface CitySuggestion {
  city: string;
  region: string;
}

interface Props {
  value: string;
  country: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const DEBOUNCE_MS = 300;

export function CityAutocomplete({ value, country, disabled, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Nach einer Auswahl setzt onChange den Input-Wert — dieser Effect-
  // Durchlauf darf keinen neuen Fetch feuern (sonst poppt das Dropdown
  // direkt wieder auf).
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(
          `/api/lists/cities?q=${encodeURIComponent(query)}&country=${country}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          suggestions: CitySuggestion[];
        };
        setSuggestions(data.suggestions);
        setOpen(data.suggestions.length > 0);
        setActiveIndex(-1);
      } catch {
        // Abort oder Netzfehler — Feld bleibt als Freitext nutzbar.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, country]);

  // Landwechsel: eine frueher eingerastete Stadt gehoert evtl. nicht
  // mehr zum Land — Haekchen zuruecknehmen, Text stehen lassen.
  useEffect(() => {
    setSelected(false);
  }, [country]);

  function handleSelect(suggestion: CitySuggestion) {
    skipNextFetch.current = true;
    onChange(suggestion.city);
    setSelected(true);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Enter uebernimmt den markierten (sonst obersten) Vorschlag,
      // statt das Formular abzuschicken.
      event.preventDefault();
      handleSelect(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    }
  }

  return (
    <label className="beta-field">
      <span className="beta-field-label">City</span>
      <div className="lists-city-wrap">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setSelected(false);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
          placeholder="Cologne"
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          style={selected ? { paddingRight: 44 } : undefined}
        />
        {selected && (
          <span className="lists-city-check" aria-hidden="true">
            ✓
          </span>
        )}
        {open && (
          <div className="lists-city-dropdown" role="listbox">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.city}-${suggestion.region}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={
                  "lists-city-option" +
                  (index === activeIndex ? " is-active" : "")
                }
                // preventDefault auf mousedown, damit der Input-Blur den
                // Klick nicht wegschnappt (Dropdown schloesse sonst vor
                // dem onClick).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(suggestion)}
              >
                <span className="lists-city-option-name">
                  {suggestion.city}
                </span>
                <span className="lists-city-option-region">
                  {suggestion.region}
                </span>
              </button>
            ))}
            <div className="lists-city-attribution">powered by Google</div>
          </div>
        )}
      </div>
    </label>
  );
}
