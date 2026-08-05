"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_LOCATIONS } from "@/lib/lists/fanout";
import { searchRegions } from "@/lib/lists/geo-regions";
import {
  SuggestDropdown,
  handleSuggestKeys,
  type SuggestOption,
} from "./suggest";

/**
 * Locations-Feld (ersetzt das Ein-Stadt-City-Feld, Generator-v3 §14b
 * Punkt 5): mehrere Staedte UND/ODER Bundeslaender/States als Chips
 * mit X zum Entfernen, Cap MAX_LOCATIONS. Vorschlaege gemischt aus
 * Google Places (Staedte, via Proxy wie gehabt) und dem lokalen
 * Geo-Asset (Regionen, sublabel "State"). Freitext wird per Enter zum
 * Chip (Jan-Entscheidung: Doerfer/Places-Ausfall duerfen nie blocken)
 * — ohne Haekchen-Anspruch, zaehlt immer als Stadt.
 *
 * KEIN umschliessendes <label> — Begruendung siehe CountryAutocomplete
 * (Label-Aktivierung beim Klick auf Dropdown-Vorschlaege).
 */

export interface LocationChip {
  name: string;
  /** Gesetzt bei Region-Chips (GEO_REGIONS-ID). */
  regionId?: string;
  /** true = aus Vorschlag uebernommen (kanonischer Name). */
  canonical: boolean;
}

interface Props {
  chips: LocationChip[];
  country: string | null;
  disabled?: boolean;
  onChange: (chips: LocationChip[]) => void;
  /** Zeigt den Pflicht-Stern am Label. */
  required?: boolean;
}

const DEBOUNCE_MS = 300;

/** value-Encoding der gemischten Vorschlaege: "region:<id>" | "city:<name>" */
const REGION_PREFIX = "region:";
const CITY_PREFIX = "city:";

export function LocationsField({
  chips,
  country,
  disabled,
  onChange,
  required,
}: Props) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const atCap = chips.length >= MAX_LOCATIONS;

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2 || !country || atCap) {
      setOptions([]);
      setOpen(false);
      return;
    }

    // Lokale Regionen sofort, Places-Staedte debounced dazu — beide in
    // EINEM Dropdown (Regionen zuerst, klar als "State" gelabelt).
    const regionOptions = searchRegions(query, country).map((region) => ({
      value: `${REGION_PREFIX}${region.id}`,
      label: region.name,
      sublabel: "State",
    }));
    setOptions(regionOptions);
    setOpen(regionOptions.length > 0);
    setActiveIndex(-1);

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
        const cityOptions = data.suggestions.map((s) => ({
          value: `${CITY_PREFIX}${s.city}`,
          label: s.city,
          sublabel: s.region,
        }));
        const merged = [...regionOptions, ...cityOptions];
        setOptions(merged);
        setOpen(merged.length > 0);
        setActiveIndex(-1);
      } catch {
        // Abort oder Netzfehler — Regionen/Freitext funktionieren weiter.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, country, atCap]);

  function addChip(chip: LocationChip) {
    if (atCap) return;
    const key = chip.regionId ?? chip.name.toLowerCase();
    const exists = chips.some(
      (c) => (c.regionId ?? c.name.toLowerCase()) === key,
    );
    if (!exists) onChange([...chips, chip]);
    setText("");
    setOptions([]);
    setOpen(false);
  }

  function handlePick(option: SuggestOption) {
    if (option.value.startsWith(REGION_PREFIX)) {
      addChip({
        name: option.label,
        regionId: option.value.slice(REGION_PREFIX.length),
        canonical: true,
      });
    } else {
      addChip({ name: option.label, canonical: true });
    }
  }

  function removeChip(target: LocationChip) {
    onChange(
      chips.filter(
        (c) =>
          (c.regionId ?? c.name.toLowerCase()) !==
          (target.regionId ?? target.name.toLowerCase()),
      ),
    );
  }

  return (
    <div className="beta-field">
      <label className="beta-field-label" htmlFor="lists-locations-input">
        {required && <span className="lists-req">* </span>}
        Locations
      </label>
      <div className="lists-suggest-wrap">
        {/* Tag-Input: Chips leben IM Feld (Jan-Wunsch, Outscraper-
            Muster) — die Box traegt den Input-Look, der echte Input
            ist unsichtbar eingebettet und waechst mit. */}
        <div
          className={"lists-locbox" + (disabled ? " is-disabled" : "")}
          onMouseDown={(e) => {
            // Klick irgendwo in der Box fokussiert den Input — ausser
            // auf den X-Buttons der Chips.
            if (e.target === e.currentTarget) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          {chips.map((chip) => (
            <span
              key={chip.regionId ?? chip.name.toLowerCase()}
              className={
                "lists-loc-chip" + (chip.regionId ? " is-region" : "")
              }
            >
              {chip.name}
              {chip.regionId && (
                <span className="lists-loc-chip-tag">State</span>
              )}
              <button
                type="button"
                className="lists-loc-chip-x"
                aria-label={`Remove ${chip.name}`}
                onClick={() => removeChip(chip)}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id="lists-locations-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Backspace im leeren Input entfernt den letzten Chip
              // (Standard-Tag-Input-Verhalten).
              if (e.key === "Backspace" && text === "" && chips.length > 0) {
                removeChip(chips[chips.length - 1]);
                return;
              }
              // Freitext-Enter: ohne offene Vorschlaege wird der Text
              // selbst zum Chip (und submitted nie das Formular).
              if (e.key === "Enter" && (!open || options.length === 0)) {
                e.preventDefault();
                const value = text.trim();
                if (value.length >= 2)
                  addChip({ name: value, canonical: false });
                return;
              }
              handleSuggestKeys(e, {
                open,
                options,
                activeIndex,
                setActiveIndex,
                onPick: handlePick,
                onClose: () => setOpen(false),
              });
            }}
            onBlur={() => setOpen(false)}
            placeholder={
              atCap
                ? `Up to ${MAX_LOCATIONS} locations`
                : chips.length > 0
                  ? "Add more"
                  : "Add cities or states"
            }
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled || atCap}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
        </div>
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
