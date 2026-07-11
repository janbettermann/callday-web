"use client";

import { useEffect, useRef, useState } from "react";
import {
  SuggestDropdown,
  handleSuggestKeys,
  type SuggestOption,
} from "./suggest";

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

interface Props {
  value: string;
  country: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const DEBOUNCE_MS = 300;

export function CityAutocomplete({ value, country, disabled, onChange }: Props) {
  const [options, setOptions] = useState<SuggestOption[]>([]);
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
    if (query.length < 2 || !country) {
      setOptions([]);
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
          suggestions: Array<{ city: string; region: string }>;
        };
        const mapped = data.suggestions.map((s) => ({
          value: s.city,
          label: s.city,
          sublabel: s.region,
        }));
        setOptions(mapped);
        setOpen(mapped.length > 0);
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

  function handlePick(option: SuggestOption) {
    skipNextFetch.current = true;
    onChange(option.value);
    setSelected(true);
    setOpen(false);
    setOptions([]);
  }

  // KEIN umschliessendes <label> — Begruendung siehe CountryAutocomplete
  // (Label-Aktivierung beim Klick auf Dropdown-Vorschlaege).
  return (
    <div className="beta-field">
      <label className="beta-field-label" htmlFor="lists-city-input">
        City
      </label>
      <div className="lists-suggest-wrap">
        <input
          id="lists-city-input"
          type="text"
          value={value}
          onChange={(e) => {
            setSelected(false);
            onChange(e.target.value);
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
          <span className="lists-suggest-check" aria-hidden="true">
            ✓
          </span>
        )}
        {open && (
          <SuggestDropdown
            options={options}
            activeIndex={activeIndex}
            attribution="powered by Google"
            onPick={handlePick}
          />
        )}
      </div>
    </div>
  );
}
