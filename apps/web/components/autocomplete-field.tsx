"use client";

import { useEffect, useId, useState } from "react";
import { Field, Input, Label } from "@/components/ui/input";

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
    <Field>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="text"
        value={selected ? optionLabel(selected) : query}
        onChange={(e) => {
          setSelected(null);
          onSelect?.(null);
          setQuery(e.target.value);
        }}
        placeholder={kind === "language" ? "e.g. Mandarin" : "e.g. Michigan"}
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
  );
}
