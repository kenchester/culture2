"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Used only for a "global origin" partner - one without a single locked
// origin, so the visitor has to pick their own, same shape as the main
// site's search form. The origin field is intentionally unrestricted
// (any language/place in the world); only the location field is scoped to
// the partner's jurisdiction.
export function EmbedSearchForm({
  partnerSlug,
  locationLabel = "Your Location",
}: {
  partnerSlug: string;
  locationLabel?: string;
}) {
  const [originKind, setOriginKind] = useState<"place" | "language">("place");

  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
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
        placeholder={originKind === "place" ? "e.g. Tamil Nadu, India" : undefined}
      />
      <AutocompleteField
        label={locationLabel}
        kind="place"
        hiddenName="locationId"
        searchUrl={`/api/embed/${partnerSlug}/places/search`}
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
