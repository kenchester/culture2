"use client";

import { useEffect, useId, useState } from "react";

export type PlaceOption = {
  id: number;
  name: string;
  type: "country" | "region" | "city";
  parent?: { name: string } | null;
};

export type LanguageOption = { id: number; name: string };

export type AutocompleteOption = PlaceOption | LanguageOption;

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
  searchUrl = "/api/places/search",
  onSelect,
}: {
  label: string;
  kind: "place" | "language";
  hiddenName?: string;
  searchUrl?: string;
  onSelect?: (option: AutocompleteOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [selected, setSelected] = useState<AutocompleteOption | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`${searchUrl}?q=${encodeURIComponent(query)}&kind=${kind}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then(setOptions)
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, kind, selected, searchUrl]);

  const visibleOptions = selected ? [] : options;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={selected ? optionLabel(selected) : query}
        onChange={(e) => {
          setSelected(null);
          onSelect?.(null);
          setQuery(e.target.value);
        }}
        placeholder={kind === "language" ? "e.g. Mandarin" : "e.g. Michigan"}
        className="rounded border px-3 py-2"
      />
      {hiddenName && <input type="hidden" name={hiddenName} value={selected?.id ?? ""} />}
      {visibleOptions.length > 0 && (
        <ul className="rounded border">
          {visibleOptions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(option);
                  setOptions([]);
                  onSelect?.(option);
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-100"
              >
                {optionLabel(option)}
                {"type" in option && (
                  <span className="ml-2 text-xs text-zinc-500">{option.type}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
