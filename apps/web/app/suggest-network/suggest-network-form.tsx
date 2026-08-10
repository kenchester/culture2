"use client";

import { useState } from "react";
import { suggestNetwork } from "@/app/suggest-network/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

const PLACE_TYPES = [
  { value: "city", label: "City" },
  { value: "region", label: "State/Province" },
  { value: "country", label: "Country" },
] as const;

// One submission, not a paired origin+location - a language or a place both
// pull from the same underlying data, so asking for both was redundant.
export function SuggestNetworkForm() {
  const [kind, setKind] = useState<"language" | "place">("place");

  return (
    <form action={suggestNetwork} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setKind("language")}
          className={`rounded px-3 py-1.5 transition-colors ${
            kind === "language" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          Speak
        </button>
        <button
          type="button"
          onClick={() => setKind("place")}
          className={`rounded px-3 py-1.5 transition-colors ${
            kind === "place" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          From
        </button>
      </div>
      <Field>
        <Label htmlFor="suggestionText">{kind === "language" ? "Language" : "Place"}</Label>
        <Input
          id="suggestionText"
          name="suggestionText"
          placeholder={kind === "language" ? "e.g. Tagalog" : "e.g. Austin, Texas"}
          required
        />
      </Field>
      {kind === "place" && (
        <Field>
          <Label>Type</Label>
          <div className="flex gap-4 text-sm text-body">
            {PLACE_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-1.5">
                <input type="radio" name="placeType" value={type.value} required />
                {type.label}
              </label>
            ))}
          </div>
        </Field>
      )}
      <Button type="submit" className="w-full">
        Submit suggestion
      </Button>
    </form>
  );
}
