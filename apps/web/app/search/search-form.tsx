"use client";

import { useEffect, useState } from "react";

type PlaceOption = {
  id: number;
  name: string;
  type: "country" | "region" | "city";
  parent?: { name: string } | null;
};

type LanguageOption = { id: number; name: string };

type Option = PlaceOption | LanguageOption;

function optionLabel(option: Option) {
  if ("type" in option) {
    return option.parent ? `${option.name}, ${option.parent.name}` : option.name;
  }
  return option.name;
}

function AutocompleteField({
  label,
  kind,
  hiddenName,
  onSelect,
}: {
  label: string;
  kind: "place" | "language";
  hiddenName: string;
  onSelect?: (option: Option | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(query)}&kind=${kind}`, {
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
  }, [query, kind, selected]);

  const visibleOptions = selected ? [] : options;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        value={selected ? optionLabel(selected) : query}
        onChange={(e) => {
          setSelected(null);
          onSelect?.(null);
          setQuery(e.target.value);
        }}
        placeholder={kind === "language" ? "e.g. Mandarin" : "e.g. Michigan"}
        required
        className="rounded border px-3 py-2"
      />
      <input type="hidden" name={hiddenName} value={selected?.id ?? ""} />
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

export function SearchForm() {
  const [originKind, setOriginKind] = useState<"place" | "language">("language");

  return (
    <form action="/search/results" className="flex flex-col gap-6">
      <input type="hidden" name="originKind" value={originKind} />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={originKind === "language"}
            onChange={() => setOriginKind("language")}
          />
          Speak
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={originKind === "place"}
            onChange={() => setOriginKind("place")}
          />
          From
        </label>
      </div>
      <AutocompleteField
        key={originKind}
        label={originKind === "language" ? "Language" : "Origin place"}
        kind={originKind}
        hiddenName="originId"
      />
      <AutocompleteField label="Location" kind="place" hiddenName="locationId" />
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">
        Search
      </button>
    </form>
  );
}
