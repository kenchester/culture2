"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

export function SearchForm() {
  const [originKind, setOriginKind] = useState<"place" | "language">("place");

  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value={originKind} />
      <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setOriginKind("language")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "language"
              ? "bg-primary text-white"
              : "text-body hover:text-primary"
          }`}
        >
          Speak
        </button>
        <button
          type="button"
          onClick={() => setOriginKind("place")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "place"
              ? "bg-primary text-white"
              : "text-body hover:text-primary"
          }`}
        >
          From
        </button>
      </div>
      <AutocompleteField
        key={originKind}
        label={originKind === "language" ? "Language" : "Origin place"}
        kind={originKind}
        hiddenName="originId"
        queryName="originQuery"
        placeholder={originKind === "place" ? "e.g. Tamil Nadu, India" : undefined}
      />
      <AutocompleteField
        label="Location"
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
        placeholder="e.g. Detroit, Michigan"
      />
      <Button type="submit" className="w-full">
        Search
      </Button>
    </form>
  );
}
