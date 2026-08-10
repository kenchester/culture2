"use client";

import { useState } from "react";
import { AutocompleteField, type PlaceOption } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

type PlaceType = "country" | "region" | "city";

const TYPE_LABEL: Record<PlaceType, string> = {
  country: "Country",
  region: "State/Province",
  city: "City",
};

// A region's parent is always a country. A city's parent is usually a
// state/province, but not everywhere has that layer of government - so a
// city can be assigned directly to a country instead, leaving the
// state/province out entirely, matching what the database itself already
// allows (a city's parent may be either a country or a region).
function CityParentPicker({
  parentType,
  onParentTypeChange,
  initialOption,
}: {
  parentType: "region" | "country";
  onParentTypeChange: (type: "region" | "country") => void;
  initialOption?: PlaceOption | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 text-sm text-body">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={parentType === "region"}
            onChange={() => onParentTypeChange("region")}
          />
          Has a state/province
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={parentType === "country"}
            onChange={() => onParentTypeChange("country")}
          />
          Country only (no state/province)
        </label>
      </div>
      <AutocompleteField
        key={parentType}
        label={TYPE_LABEL[parentType]}
        kind="place"
        placeType={parentType}
        hiddenName="parentId"
        initialOption={parentType === initialOption?.type ? initialOption : null}
        placeholder={parentType === "country" ? "e.g. United States" : "e.g. Ohio"}
      />
    </div>
  );
}

export function PlaceManager({
  createPlace,
  updatePlace,
}: {
  createPlace: (formData: FormData) => void;
  updatePlace: (formData: FormData) => void;
}) {
  const [newType, setNewType] = useState<PlaceType>("country");
  const [newCityParentType, setNewCityParentType] = useState<"region" | "country">("region");

  const [editing, setEditing] = useState<PlaceOption | null>(null);
  const [editName, setEditName] = useState("");
  const [editCityParentType, setEditCityParentType] = useState<"region" | "country">("region");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Add a geography</h3>
        <form action={createPlace} className="flex flex-col gap-3">
          <div className="flex gap-4 text-sm text-body">
            {(["country", "region", "city"] as const).map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="type"
                  value={type}
                  checked={newType === type}
                  onChange={() => setNewType(type)}
                />
                {TYPE_LABEL[type]}
              </label>
            ))}
          </div>
          <Field>
            <Label htmlFor="new-place-name">Name</Label>
            <Input id="new-place-name" name="name" placeholder="e.g. Ohio" required />
          </Field>
          {newType === "region" && (
            <AutocompleteField
              label="Country"
              kind="place"
              placeType="country"
              hiddenName="parentId"
              placeholder="e.g. United States"
            />
          )}
          {newType === "city" && (
            <CityParentPicker
              parentType={newCityParentType}
              onParentTypeChange={setNewCityParentType}
            />
          )}
          <Button type="submit" className="self-start">
            Add
          </Button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Edit a geography</h3>
        <AutocompleteField
          key={editing?.id ?? "search"}
          label="Find a place"
          kind="place"
          onSelect={(option) => {
            const place = option as PlaceOption | null;
            setEditing(place);
            setEditName(place?.name ?? "");
            setEditCityParentType(place?.parent?.type === "country" ? "country" : "region");
          }}
        />
        {editing && (
          <form action={updatePlace} className="mt-2 flex flex-col gap-3">
            <input type="hidden" name="id" value={editing.id} />
            <input type="hidden" name="type" value={editing.type} />
            <p className="text-sm text-muted">Type: {TYPE_LABEL[editing.type]} (fixed)</p>
            <Field>
              <Label htmlFor="edit-place-name">Name</Label>
              <Input
                id="edit-place-name"
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </Field>
            {editing.type === "region" && (
              <AutocompleteField
                key={editing.id}
                label="Country"
                kind="place"
                placeType="country"
                hiddenName="parentId"
                initialOption={
                  editing.parent_id && editing.parent
                    ? { id: editing.parent_id, name: editing.parent.name, type: "country" }
                    : null
                }
              />
            )}
            {editing.type === "city" && (
              <CityParentPicker
                parentType={editCityParentType}
                onParentTypeChange={setEditCityParentType}
                initialOption={
                  editing.parent_id && editing.parent
                    ? {
                        id: editing.parent_id,
                        name: editing.parent.name,
                        type: editing.parent.type ?? "region",
                      }
                    : null
                }
              />
            )}
            <div className="flex gap-2">
              <Button type="submit" className="self-start">
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
