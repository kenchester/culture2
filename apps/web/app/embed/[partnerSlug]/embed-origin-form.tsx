"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/autocomplete-field";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * The inbound direction's single question: where are you from?
 *
 * The mirror of EmbedLocationForm. There, the origin is fixed by the
 * partner and the visitor supplies the location; here the location is
 * fixed to the partner's home place and the visitor supplies the origin.
 *
 * The origin field is deliberately unscoped - no searchUrl, so it hits
 * the site-wide place search rather than the partner's jurisdiction
 * endpoint. A jurisdiction answers "which locations may this partner's
 * diaspora be in", which is the wrong question entirely for a city asking
 * who has moved TO it: the answer is anywhere in the world, and scoping it
 * would quietly exclude most of the people the embed exists to find.
 */
export function EmbedOriginForm({
  partnerSlug,
  dir,
  originLabel = "Where are you from?",
}: {
  partnerSlug: string;
  /** Preserved so the submitted search stays on the inbound tab. */
  dir: string;
  originLabel?: string;
}) {
  const [originKind, setOriginKind] = useState<"place" | "language">("place");

  return (
    <form action={`/embed/${partnerSlug}`} className="flex flex-col gap-4">
      <input type="hidden" name="dir" value={dir} />
      <input type="hidden" name="originKind" value={originKind} />
      {/* Language as well as place, matching the main site: "Cantonese
          speakers in Ningde" is a real community, and for somewhere with
          a lot of internal migration the language is often the thing
          people actually organise around rather than the province. */}
      <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setOriginKind("place")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "place" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          From
        </button>
        <button
          type="button"
          onClick={() => setOriginKind("language")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "language" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          Speak
        </button>
      </div>
      <AutocompleteField
        key={originKind}
        label={originKind === "language" ? "Which language do you speak?" : originLabel}
        kind={originKind}
        hiddenName="originId"
        queryName="originQuery"
        placeholder={originKind === "place" ? "e.g. Sichuan, China" : undefined}
      />
      <SubmitButton>Search</SubmitButton>
    </form>
  );
}
