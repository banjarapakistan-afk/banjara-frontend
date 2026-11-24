"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, MapPin, Star, X, type LucideIcon } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useQuery } from "@/lib/live-query";
import {
  searchPlaces,
  type PlaceResult,
} from "@/services/customer/provider-application.service";
import styles from "./auth.module.css";
import place from "./place-field.module.css";

/** Places travellers ask for most; shown before the user types. */
export const POPULAR_PLACES = [
  "Islamabad",
  "Rawalpindi",
  "Lahore",
  "Gilgit",
  "Hunza",
  "Skardu",
  "Naran",
  "Murree",
  "Swat",
  "Chitral",
  "Fairy Meadows",
  "Khaplu",
];

/** Search results that are a street or a building, not a place someone lives or drives from. */
const NOT_A_TOWN =
  /\b(street|st\.?|road|rd\.?|lane|gali|plaza|market|bazaar|mall|tower|centre|center|chowk|block|sector|phase|hospital|school|college|university|masjid|mosque|jamat ?khana|bank|office|apartments?|stop|cafe|café|restaurant|hotel|shop|store)\b/i;

type Option =
  | { kind: "popular"; label: string }
  | { kind: "place"; label: string; detail: string; place: PlaceResult };

function detailOf(item: PlaceResult) {
  const a = item.address ?? {};
  return [a.area, a.city !== item.name ? a.city : "", a.region]
    .filter((part) => part && part !== item.name)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(", ") || "Pakistan";
}

/** The value we store: the town/city for a place, falling back to its name. */
export function placeLabel(item: PlaceResult) {
  return item.address?.city?.trim() || item.name;
}

/**
 * Place picker that looks like every other BANJARA field (pill, leading icon) and
 * opens a styled list instead of the browser's own dropdown.
 * Empty: popular places. Typing: live search of every city, town and village in Pakistan.
 * Keyboard: ↑ ↓ to move, Enter to choose, Esc to close. Typed text is kept if nothing is chosen.
 */
export function PlaceField({
  label,
  value,
  onChange,
  onPick,
  icon: Icon = MapPin,
  placeholder = "Search a city or town",
  error,
  hint,
  name,
  onBlur,
  popular = POPULAR_PLACES,
  exclude,
  townsOnly = true,
  fill = "name",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with the full place when the user chooses a search result. */
  onPick?: (place: PlaceResult | null, value: string) => void;
  icon?: LucideIcon;
  placeholder?: string;
  error?: string;
  hint?: string;
  name?: string;
  onBlur?: () => void;
  popular?: string[];
  /** A place that can't be chosen here (e.g. the "From" of a route). */
  exclude?: string;
  /** Hide streets, plazas, shops… so only cities, towns, villages and valleys show. Default on. */
  townsOnly?: boolean;
  /**
   * What a chosen result puts in the field: just its name ("Karimabad", for a city field),
   * or the full address ("Karimabad, Hunza, Gilgit-Baltistan, Pakistan", for an address field).
   */
  fill?: "name" | "address";
}) {
  const id = useId();
  const listId = `${id}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeRaw, setActive] = useState(0);
  const query = value.trim();
  const debounced = useDebouncedValue(query, 300);
  const searching = debounced.length >= 2;

  const results = useQuery({
    queryKey: ["places", debounced.toLowerCase()],
    queryFn: () => searchPlaces(debounced, 8),
    enabled: open && searching,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const skip = (label: string) => Boolean(exclude) && label.toLowerCase() === exclude!.trim().toLowerCase();

  const options = useMemo<Option[]>(() => {
    const q = query.toLowerCase();
    const popularMatches = popular
      .filter((city) => !skip(city))
      .filter((city) => !q || city.toLowerCase().includes(q))
      .slice(0, searching ? 3 : 8)
      .map((label) => ({ kind: "popular" as const, label }));
    if (!searching) return popularMatches;
    const seen = new Set(popularMatches.map((o) => o.label.toLowerCase()));
    const live = (results.data ?? [])
      .filter((item) => !skip(item.name))
      .filter((item) => !townsOnly || !NOT_A_TOWN.test(item.name))
      .filter((item) => {
        const key = `${item.name}|${detailOf(item)}`.toLowerCase();
        if (seen.has(item.name.toLowerCase()) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({ kind: "place" as const, label: item.name, detail: detailOf(item), place: item }));
    return [...popularMatches, ...live];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popular, query, searching, results.data, exclude, townsOnly]);

  // The list can shrink while typing: fall back to the first row instead of a missing one.
  const active = activeRaw < options.length ? activeRaw : 0;
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (option: Option) => {
    // Keep exactly what the user clicked ("Karimabad"), not its parent city ("Hunza").
    const next =
      fill === "address" && option.kind === "place"
        ? option.place.address?.formattedAddress?.trim() ||
          [option.label, option.detail === "Pakistan" ? "" : option.detail, "Pakistan"]
            .filter(Boolean)
            .join(", ")
        : option.label;
    onChange(next);
    onPick?.(option.kind === "place" ? option.place : null, next);
    setOpen(false);
  };

  const loading = searching && (results.isFetching || debounced !== query) && !results.data?.length;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`${styles.field} ${place.wrap}`} ref={wrapRef}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      </div>
      <div className={place.anchor}>
      <div className={styles.control}>
        <Icon size={17} />
        <input
          id={id}
          name={name}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={[styles.input, place.input, error ? styles.inputError : ""].join(" ")}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => onBlur?.()}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) setOpen(true);
              else setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && open && options[active]) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === "Escape" || event.key === "Tab") {
              setOpen(false);
            }
          }}
        />
        <span className={place.trailing}>
          {loading && open ? <LoaderCircle size={15} className="animate-spin" /> : null}
          {value ? (
            <button
              type="button"
              className={place.clear}
              aria-label={`Clear ${label}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange("");
                onPick?.(null, "");
                setOpen(true);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className={place.toggle}
            tabIndex={-1}
            aria-label={open ? `Close ${label} list` : `Open ${label} list`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown size={16} className={`${place.chevron} ${open ? place.chevronOpen : ""}`} />
          </button>
        </span>
      </div>

      {open ? (
        <ul id={listId} ref={listRef} role="listbox" aria-label={label} className={place.panel}>
          {!searching && options.length ? <li className={place.heading}>Popular places</li> : null}
          {!searching && !options.length ? (
            <li className={place.status}>
              <MapPin size={14} /> Type at least 2 letters to search places across Pakistan
            </li>
          ) : null}
          {options.map((option, index) => (
            <li
              key={`${option.kind}-${option.label}-${index}`}
              id={`${id}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === active}
              className={`${place.option} ${index === active ? place.optionActive : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span className={place.optionIcon}>
                {option.kind === "popular" ? <Star size={13} /> : <MapPin size={14} />}
              </span>
              <span className={place.optionText}>
                <strong>{option.label}</strong>
                {option.kind === "place" ? <span>{option.detail}</span> : null}
              </span>
            </li>
          ))}
          {searching && loading ? (
            <li className={place.status}>
              <LoaderCircle size={14} className="animate-spin" /> Searching all of Pakistan…
            </li>
          ) : null}
          {searching && !loading && results.isError ? (
            <li className={place.status}>Search is unavailable right now. You can type the place name.</li>
          ) : null}
          {searching && !loading && !results.isError && !options.length ? (
            <li className={place.status}>No match for “{query}”. Check the spelling, or keep what you typed.</li>
          ) : null}
        </ul>
      ) : null}
      </div>

      {error ? (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
