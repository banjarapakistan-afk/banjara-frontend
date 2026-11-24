"use client";

import { ArrowUpDown, Check } from "lucide-react";
import type { DiscoverResult } from "@/types/customer/discover";
import { ChipDropdown } from "./chip-dropdown";
import { sortIcon } from "./explore-filter-bar";
import styles from "./explore.module.css";

/**
 * Sort dropdown and quick-filter chips. The options, their labels and the rules behind
 * them all come from the server (GET /api/discover) — nothing is hard-coded here.
 * Rendered inline so it shares one row with the category chips.
 */
export function ExploreRefineBar({
  options,
  applied,
  update,
}: {
  options: DiscoverResult["options"];
  applied: DiscoverResult["applied"];
  update: (patch: Record<string, string | null>) => void;
}) {
  if (!options.sorts.length && !options.toggles.length) return null;
  const setOnly = (only: string[]) =>
    update({ only: only.length ? only.join(",") : null });
  return (
    <div className={styles.refineBar}>
      {options.categories.length > 0 && (
        <span className={styles.chipDivider} aria-hidden="true" />
      )}
      {options.sorts.length > 0 && (
        <ChipDropdown
          icon={<ArrowUpDown size={16} aria-hidden="true" />}
          label="Sort by"
          align="end"
          value={applied.order}
          active={applied.order !== "recommended"}
          options={options.sorts.map((item) => ({
            value: item.id,
            label: item.label,
            icon: sortIcon(item.id),
          }))}
          onChange={(order) =>
            update({ order: order === "recommended" ? null : order })
          }
        />
      )}
      {options.toggles.length > 0 && (
        <div className={styles.catalogChips} role="group" aria-label="Quick filters">
          {options.toggles.map((item) => {
            const on = applied.only.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={on}
                onClick={() =>
                  setOnly(
                    on
                      ? applied.only.filter((id) => id !== item.id)
                      : [...applied.only, item.id],
                  )
                }
              >
                {on && <Check size={14} aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
