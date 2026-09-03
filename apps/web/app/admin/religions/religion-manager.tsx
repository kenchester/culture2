"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

type Religion = { id: number; name: string; aliases: string[] };

export function ReligionManager({
  religions,
  createReligion,
  updateReligion,
}: {
  religions: Religion[];
  createReligion: (formData: FormData) => void;
  updateReligion: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState<Religion | null>(null);
  const [editName, setEditName] = useState("");
  const [editAliases, setEditAliases] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Add a religion</h3>
        <form action={createReligion} className="flex items-end gap-2">
          <Field>
            <Label htmlFor="new-religion-name">Name</Label>
            <Input id="new-religion-name" name="name" placeholder="e.g. Zoroastrian" required />
          </Field>
          <Field>
            <Label htmlFor="new-religion-aliases">Aliases (comma-separated)</Label>
            <Input
              id="new-religion-aliases"
              name="aliases"
              placeholder="e.g. Zoroastrianism"
            />
          </Field>
          <SubmitButton>Add</SubmitButton>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Edit a religion</h3>
        <AutocompleteField
          key={editing?.id ?? "search"}
          label="Find a religion"
          kind="religion"
          onSelect={(option) => {
            const found = option ? (religions.find((r) => r.id === option.id) ?? null) : null;
            setEditing(found);
            setEditName(found?.name ?? "");
            setEditAliases((found?.aliases ?? []).join(", "));
          }}
        />
        {editing && (
          <form action={updateReligion} className="mt-2 flex items-end gap-2">
            <input type="hidden" name="id" value={editing.id} />
            <Field>
              <Label htmlFor="edit-religion-name">Name</Label>
              <Input
                id="edit-religion-name"
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label htmlFor="edit-religion-aliases">Aliases (comma-separated)</Label>
              <Input
                id="edit-religion-aliases"
                name="aliases"
                value={editAliases}
                onChange={(e) => setEditAliases(e.target.value)}
              />
            </Field>
            <SubmitButton>Save</SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
