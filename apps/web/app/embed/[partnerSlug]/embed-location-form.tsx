"use client";

import { AutocompleteField } from "@/components/autocomplete-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function EmbedLocationForm({
  partnerSlug,
  locationLabel = "Your Location",
}: {
  partnerSlug: string;
  locationLabel?: string;
}) {
  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
      <AutocompleteField
        label={locationLabel}
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
        searchUrl={`/api/embed/${partnerSlug}/places/search`}
      />
      <SubmitButton>Search</SubmitButton>
    </form>
  );
}
