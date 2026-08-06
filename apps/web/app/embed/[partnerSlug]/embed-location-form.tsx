"use client";

import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

export function EmbedLocationForm({ partnerSlug }: { partnerSlug: string }) {
  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
      <AutocompleteField
        label="Location"
        kind="place"
        hiddenName="locationId"
        searchUrl={`/api/embed/${partnerSlug}/places/search`}
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
