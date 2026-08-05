"use client";

import { useEffect, useRef, useState } from "react";
import {
  findCountry,
  searchCountries,
  type CountryOption,
} from "@/lib/lists/countries";
import {
  ClearX,
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
  /** Zeigt den Pflicht-Stern am Label. */
  required?: boolean;
}

function toSuggestOption(option: CountryOption): SuggestOption {
  return { value: option.code, label: option.label };
}

export function CountryAutocomplete({
  code,
  disabled,
  onChange,
  required,
}: Props) {
  const [text, setText] = useState(() =>
    code ? (findCountry(code)?.label ?? "") : "",
  );
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const selected = code !== null;
  // Rechts-Icon-Logik: im Ruhezustand der Dropdown-Chevron; sobald man
  // das Feld bearbeitet (Fokus) UND etwas drinsteht, ersetzt ihn das
  // X-Clear (Chip-Style-Kreis) — nie beide gleichzeitig.
  const showClear = focused && text.trim().length > 0 && !disabled;

  // Aendert der Parent den Code von aussen (Schnellwahl-Pillen), muss
  // das Feld den passenden Laendernamen nachziehen — der Initializer
  // oben laeuft nur einmal beim Mount.
  useEffect(() => {
    if (!code) return;
    const label = findCountry(code)?.label;
    if (label) setText(label);
  }, [code]);

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

  // X-Clear: Land + Text weg → exakt der Leer-Zustand (wie beim Mount).
  // Fokus bleibt, damit man direkt neu tippen kann; onFocus zeigt dann
  // die Kern-Maerkte.
  function handleClear() {
    setText("");
    onChange(null);
    setOptions([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleBlur() {
    setOpen(false);
    setFocused(false);
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
        {required && <span className="lists-req">* </span>}
        Country
      </label>
      <div className="lists-suggest-wrap">
        {/* Bestaetigung des gewaehlten Landes = Flagge links (statt
            Check): das Land wurde ausgewaehlt, nicht "erkannt" — die
            Flagge bestaetigt die Wahl und traegt Wiedererkennung. SVGs
            liegen als statische Assets in public/flags (ISO-2, aus
            country-flag-icons; volle Abdeckung der Laenderliste). Der
            Check bleibt Industry vorbehalten (dort = erkannte Kanonik). */}
        {code && (
          <img
            className="lists-country-flag"
            src={`/flags/${code}.svg`}
            alt=""
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        )}
        <input
          ref={inputRef}
          id="lists-country-input"
          type="text"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          // Focus auf ein eingerastetes Feld zeigt die Kern-Maerkte als
          // Schnellwechsel; sonst die Treffer zum aktuellen Text.
          onFocus={() => {
            setFocused(true);
            showMatches(selected ? "" : text);
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
          onBlur={handleBlur}
          placeholder="Germany"
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          // Links Platz fuer die Flagge, rechts fuer genau EIN Icon
          // (Chevron oder X — sie ersetzen sich).
          style={{
            paddingLeft: code ? 40 : undefined,
            paddingRight: 40,
          }}
        />
        {showClear ? (
          // X-Clear im Chip-Kreis-Style (geteilte .lists-loc-chip-x),
          // ersetzt den Chevron beim Bearbeiten. preventDefault haelt
          // den Fokus, sonst schnappt der Blur den Klick weg.
          <button
            type="button"
            className="lists-loc-chip-x lists-country-clear"
            aria-label="Clear country"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            <ClearX />
          </button>
        ) : (
          // Dropdown-Chevron: reine Affordance (pointer-events none) —
          // der Klick faellt auf den Input durch und oeffnet die Liste.
          <span
            className={"lists-country-chevron" + (open ? " is-open" : "")}
            aria-hidden="true"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
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
