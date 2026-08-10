"use client";

import { useState } from "react";
import { AutocompleteField, type LanguageOption } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export function LanguageManager({
  createLanguage,
  updateLanguage,
}: {
  createLanguage: (formData: FormData) => void;
  updateLanguage: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState<LanguageOption | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Add a language</h3>
        <form action={createLanguage} className="flex items-end gap-2">
          <Field>
            <Label htmlFor="new-language-name">Name</Label>
            <Input id="new-language-name" name="name" placeholder="e.g. Yoruba" required />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Edit a language</h3>
        <AutocompleteField
          key={editing?.id ?? "search"}
          label="Find a language"
          kind="language"
          onSelect={(option) => {
            const language = option as LanguageOption | null;
            setEditing(language);
            setEditName(language?.name ?? "");
          }}
        />
        {editing && (
          <form action={updateLanguage} className="mt-2 flex items-end gap-2">
            <input type="hidden" name="id" value={editing.id} />
            <Field>
              <Label htmlFor="edit-language-name">Name</Label>
              <Input
                id="edit-language-name"
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </Field>
            <Button type="submit">Save</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
