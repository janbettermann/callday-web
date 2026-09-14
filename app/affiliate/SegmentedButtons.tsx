"use client";

/**
 * Segment-Schalter mit Buttons (clientseitiger Filter), gleiche Optik wie
 * die Link-Variante WbSegmented. Von Activity- und Earnings-Feed genutzt.
 */
export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="wb-seg" role="group" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={`wb-seg-item${active ? " is-active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
