"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/autocomplete-field";

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
