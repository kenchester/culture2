"use client";

import { useState } from "react";
import {
  AutocompleteField,
  optionLabel,
  type AutocompleteOption,
} from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export function AdminPartnerForm({
  action,
  demoAction,
}: {
  action: (formData: FormData) => void;
  demoAction: (formData: FormData) => void;
}) {
  const [originKind, setOriginKind] = useState<"place" | "language">("place");
  const [jurisdictions, setJurisdictions] = useState<AutocompleteOption[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value={originKind} />
      <input
        type="hidden"
        name="jurisdictionPlaceIds"
        value={JSON.stringify(jurisdictions.map((j) => j.id))}
      />
      <Field>
        <Label htmlFor="partner-name">Partner name</Label>
        <Input
          id="partner-name"
          name="name"
          placeholder="e.g. Embassy of Indonesia"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="partner-slug">URL slug</Label>
        <Input id="partner-slug" name="slug" placeholder="e.g. indonesia" required />
      </Field>

      <div className="flex gap-4 text-sm text-body">
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

      <label className="flex items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          name="isGlobal"
          checked={isGlobal}
          onChange={(e) => setIsGlobal(e.target.checked)}
        />
        Global (no jurisdiction restriction &mdash; any location worldwide)
      </label>

      {!isGlobal && (
        <>
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
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                >
                  {optionLabel(j)}
                  <button
                    type="button"
                    onClick={() =>
                      setJurisdictions((prev) => prev.filter((x) => x.id !== j.id))
                    }
                    className="text-error underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-body">
        <input type="checkbox" name="hideOriginLabel" defaultChecked />
        Hide origin label (white-label)
      </label>

      <div className="flex gap-3">
        <Button type="submit" className="self-start">
          Create partner
        </Button>
        <Button type="submit" formAction={demoAction} variant="secondary" className="self-start">
          Embed Demo
        </Button>
      </div>
    </form>
  );
}
