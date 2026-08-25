"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Field, Input, Label } from "@/components/ui/input";
import { isSearchableQuery } from "@/lib/search-query";

export type PlaceOption = {
  id: number;
  name: string;
  type: "country" | "region" | "city";
  parent_id?: number | null;
  parent?: { name: string; type?: "country" | "region" | "city" } | null;
};

export type LanguageOption = { id: number; name: string };
export type ReligionOption = { id: number; name: string };

export type AutocompleteOption = PlaceOption | LanguageOption | ReligionOption;

export function optionLabel(option: AutocompleteOption) {
  if ("type" in option) {
    return option.parent ? `${option.name}, ${option.parent.name}` : option.name;
  }
  return option.name;
}

export function AutocompleteField({
  label,
  kind,
  hiddenName,
  queryName,
  searchUrl = "/api/places/search",
  onSelect,
  placeholder,
  disabled = false,
  defaultValue,
  placeType,
  initialOption = null,
}: {
  label: string;
  kind: "place" | "language" | "religion";
  hiddenName?: string;
  // Submits whatever text is currently shown in the input (typed query, or
  // the selected option's label) under this form field name - lets the
  // server fall back to guessing a match when the user never picked a
  // suggestion from the dropdown.
  queryName?: string;
  searchUrl?: string;
  onSelect?: (option: AutocompleteOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultValue?: string;
  placeType?: "country" | "region" | "city";
  initialOption?: AutocompleteOption | null;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [selected, setSelected] = useState<AutocompleteOption | null>(initialOption);
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  // Otherwise the suggestion list stays open until the user picks an option
  // or types something else - clicking anywhere else on the page should
  // dismiss it too, without touching whatever text they've already typed.
  // Listening on "click" rather than "mousedown" matters here: closing the
  // dropdown on mousedown reflows the layout (the dropdown collapses,
  // shifting anything below it - like a Search button - upward) before
  // mouseup fires, so a click aimed at that button lands on empty space
  // instead and gets silently swallowed. "click" only fires once mousedown
  // and mouseup have already resolved against the same element, so the
  // button's own click (and its form submission) still goes through in the
  // same click that dismisses the dropdown.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOptions([]);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled || selected || !isSearchableQuery(query.trim())) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const typeParam = kind === "place" && placeType ? `&type=${placeType}` : "";
      // Lets a search for e.g. "Estados Unidos" find "United States" -
      // the API resolves this against whatever's already cached for this
      // locale (see 00000000000042_locale_aware_search.sql) and returns
      // the translated name in place of the English one, so results
      // already render localized with no further change needed here.
      fetch(
        `${searchUrl}?q=${encodeURIComponent(query)}&kind=${kind}${typeParam}&locale=${locale}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then(setOptions)
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, kind, selected, searchUrl, disabled, placeType, locale]);

  const visibleOptions = disabled || selected ? [] : options;

  return (
    <div ref={containerRef}>
      <Field>
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          type="text"
          name={queryName}
          disabled={disabled}
          value={disabled ? (defaultValue ?? "") : selected ? optionLabel(selected) : query}
          onChange={(e) => {
            setSelected(null);
            onSelect?.(null);
            setQuery(e.target.value);
          }}
          placeholder={
            placeholder ??
            (kind === "language" ? "e.g. Mandarin" : kind === "religion" ? "e.g. Christian" : "e.g. Michigan")
          }
          className={disabled ? "cursor-not-allowed bg-background text-muted" : undefined}
        />
        {hiddenName && <input type="hidden" name={hiddenName} value={selected?.id ?? ""} />}
        {visibleOptions.length > 0 && (
          <ul className="overflow-hidden rounded-md border border-border bg-surface shadow-sm">
            {visibleOptions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(option);
                    setOptions([]);
                    onSelect?.(option);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-primary-light"
                >
                  {optionLabel(option)}
                  {"type" in option && (
                    <span className="ml-2 text-xs text-muted">{option.type}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  );
}
