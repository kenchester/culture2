"use client";

import { useState } from "react";
import {
  AutocompleteField,
  optionLabel,
  type AutocompleteOption,
} from "@/components/autocomplete-field";

export function AdminPartnerForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [originKind, setOriginKind] = useState<"place" | "language">("place");
  const [jurisdictions, setJurisdictions] = useState<AutocompleteOption[]>([]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value={originKind} />
      <input
        type="hidden"
        name="jurisdictionPlaceIds"
        value={JSON.stringify(jurisdictions.map((j) => j.id))}
      />
      <input
        name="name"
        placeholder="Partner name, e.g. Embassy of Indonesia"
        required
        className="rounded border px-3 py-2"
      />
      <input
        name="slug"
        placeholder="URL slug, e.g. indonesia"
        required
        className="rounded border px-3 py-2"
      />

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={originKind === "language"}
            onChange={() => setOriginKind("language")}
          />
          Locked language
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={originKind === "place"}
            onChange={() => setOriginKind("place")}
          />
          Locked origin place
        </label>
      </div>
      <AutocompleteField
        key={originKind}
        label="Locked origin"
        kind={originKind}
        hiddenName="originId"
      />

      <AutocompleteField
        key={jurisdictions.length}
        label="Add a jurisdiction place"
        kind="place"
        onSelect={(option) => {
          if (option && !jurisdictions.some((j) => j.id === option.id)) {
            setJurisdictions((prev) => [...prev, option]);
          }
        }}
      />
      {jurisdictions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {jurisdictions.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
            >
              {optionLabel(j)}
              <button
                type="button"
                onClick={() =>
                  setJurisdictions((prev) => prev.filter((x) => x.id !== j.id))
                }
                className="text-red-600 underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hideOriginLabel" defaultChecked />
        Hide origin label (white-label)
      </label>

      <button type="submit" className="self-start rounded bg-black px-3 py-2 text-white">
        Create partner
      </button>
    </form>
  );
}
