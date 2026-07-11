"use client";

import { useState } from "react";
import {
  findCountry,
  searchCountries,
  type CountryOption,
} from "@/lib/lists/countries";
import {
  SuggestDropdown,
  handleSuggestKeys,
  type SuggestOption,
} from "./suggest";

/**
 * Laender-Eingabe mit lokalem Autocomplete (kein API-Call — die Liste
 * ist fix und klein). Gleiche Optik/Bedienung wie das City-Feld:
 * tippen → Vorschlaege → Auswahl rastet mit Haekchen ein.
 *
 * Anders als bei der Stadt ist Freitext hier NICHT gueltig — der
 * Generator braucht einen ISO-Code (Region-Filter fuer Places +
 * Outscraper). `code` ist deshalb null, solange nichts eingerastet
 * ist; exakt getippte Laendernamen rasten beim Verlassen des Felds
 * automatisch ein.
 */

interface Props {
  code: string | null;
  disabled?: boolean;
  onChange: (code: string | null) => void;
}

function toSuggestOption(option: CountryOption): SuggestOption {
  return { value: option.code, label: option.label };
}

export function CountryAutocomplete({ code, disabled, onChange }: Props) {
  const [text, setText] = useState(() =>
    code ? (findCountry(code)?.label ?? "") : "",
  );
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = code !== null;

  function showMatches(query: string) {
    const matches = searchCountries(query).map(toSuggestOption);
    setOptions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
  }

  function handleText(value: string) {
    setText(value);
    onChange(null);
    showMatches(value);
  }

  function handlePick(option: SuggestOption) {
    setText(option.label);
    onChange(option.value);
    setOpen(false);
  }

  function handleBlur() {
    setOpen(false);
    if (selected) return;
    // Exakt getippter Laendername zaehlt wie ein Klick auf den Vorschlag.
    const needle = text.trim().toLowerCase();
    const exact = searchCountries(text).find(
      (option) => option.label.toLowerCase() === needle,
    );
    if (exact) {
      setText(exact.label);
      onChange(exact.code);
    }
  }

  // Bewusst KEIN umschliessendes <label>: ein Klick auf einen Dropdown-
  // Vorschlag waere sonst eine Label-Aktivierung, die den Input
  // refokussiert und das Dropdown via onFocus sofort wieder oeffnet.
  return (
    <div className="beta-field">
      <label className="beta-field-label" htmlFor="lists-country-input">
        Country
      </label>
      <div className="lists-suggest-wrap">
        <input
          id="lists-country-input"
          type="text"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          // Focus auf ein eingerastetes Feld zeigt die Kern-Maerkte als
          // Schnellwechsel; sonst die Treffer zum aktuellen Text.
          onFocus={() => showMatches(selected ? "" : text)}
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
          onBlur={handleBlur}
          placeholder="Germany"
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
            onPick={handlePick}
          />
        )}
      </div>
    </div>
  );
}
