"use client";

import { AutocompleteField } from "@/components/autocomplete-field";

export function EmbedLocationForm({ partnerSlug }: { partnerSlug: string }) {
  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
      <AutocompleteField
        label="Location"
        kind="place"
        hiddenName="locationId"
        searchUrl={`/api/embed/${partnerSlug}/places/search`}
      />
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">
        Search
      </button>
    </form>
  );
}
