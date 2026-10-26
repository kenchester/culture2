"use client";

import { AutocompleteField } from "@/components/autocomplete-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function EmbedLocationForm({
  partnerSlug,
  locationLabel = "Your Location",
  dir,
}: {
  partnerSlug: string;
  locationLabel?: string;
  /**
   * Set only for a home-place embed showing both directions, so the
   * submitted search comes back to the tab the visitor was on rather
   * than silently reverting to the default one.
   */
  dir?: string;
}) {
  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
      {dir && <input type="hidden" name="dir" value={dir} />}
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
