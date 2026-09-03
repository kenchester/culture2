"use client";

import { useState } from "react";
import { AutocompleteField, type LanguageOption } from "@/components/autocomplete-field";
import { getLanguageDetails } from "@/app/admin/places/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

// Shared by the add and edit forms so the two can't drift - the help text
// is the only place an admin learns what these fields are for, and it
// matters that both explain them identically.
function LanguageFields({
  idPrefix,
  isoCode,
  onIsoCodeChange,
  isSigned,
  onIsSignedChange,
}: {
  idPrefix: string;
  isoCode: string;
  onIsoCodeChange: (value: string) => void;
  isSigned: boolean;
  onIsSignedChange: (value: boolean) => void;
}) {
  return (
    <>
      <Field>
        <Label htmlFor={`${idPrefix}-iso`}>ISO 639-1 code (optional)</Label>
        <Input
          id={`${idPrefix}-iso`}
          name="isoCode"
          value={isoCode}
          onChange={(e) => onIsoCodeChange(e.target.value)}
          placeholder="es"
          maxLength={2}
          className="w-24"
          aria-describedby={`${idPrefix}-iso-help`}
        />
        <p id={`${idPrefix}-iso-help`} className="text-xs text-muted">
          Two lowercase letters — <code>es</code> Spanish, <code>zh</code> Mandarin,{" "}
          <code>fr</code> French, <code>ar</code> Arabic. Find one on{" "}
          <a
            href="https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Wikipedia&apos;s ISO 639 list
          </a>{" "}
          (use the &ldquo;Set 1&rdquo; column). Leave blank if there isn&apos;t one — most
          regional, indigenous and sign languages have no ISO 639-1 code, and blank is the
          correct answer for them. When set, it&apos;s used to tell the transcriber which
          language to expect, to tag text for screen readers, and to check that posts stay
          in the target language.
        </p>
      </Field>

      <Field>
        <label className="flex items-start gap-2 text-sm text-body">
          <input
            type="checkbox"
            name="isSigned"
            checked={isSigned}
            onChange={(e) => onIsSignedChange(e.target.checked)}
            className="mt-1"
            aria-describedby={`${idPrefix}-signed-help`}
          />
          <span>
            This is a sign language
            <span id={`${idPrefix}-signed-help`} className="mt-0.5 block text-xs text-muted">
              Hides the audio recorder in this language&apos;s networks (a signed language has
              no spoken form) and skips automatic transcription, since there is no speech to
              transcribe. Posters can add an optional written summary instead. Leave unchecked
              for spoken languages.
            </span>
          </span>
        </label>
      </Field>
    </>
  );
}

export function LanguageManager({
  createLanguage,
  updateLanguage,
}: {
  createLanguage: (formData: FormData) => void;
  updateLanguage: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState<LanguageOption | null>(null);
  const [editName, setEditName] = useState("");
  const [newIso, setNewIso] = useState("");
  const [newIsSigned, setNewIsSigned] = useState(false);
  const [editIso, setEditIso] = useState("");
  const [editIsSigned, setEditIsSigned] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function selectForEdit(language: LanguageOption | null) {
    setEditing(language);
    setEditName(language?.name ?? "");
    setEditIso("");
    setEditIsSigned(false);
    if (!language) return;
    // Loaded rather than assumed: submitting the form writes all three
    // columns, so starting from blanks would quietly erase an existing
    // iso_code or is_signed on the first save.
    setLoadingDetails(true);
    const details = await getLanguageDetails(language.id);
    setEditIso(details.iso_code ?? "");
    setEditIsSigned(details.is_signed);
    setLoadingDetails(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Add a language</h3>
        <form action={createLanguage} className="flex max-w-xl flex-col gap-3">
          <Field>
            <Label htmlFor="new-language-name">Name</Label>
            <Input id="new-language-name" name="name" placeholder="e.g. Yoruba" required />
          </Field>
          <LanguageFields
            idPrefix="new-language"
            isoCode={newIso}
            onIsoCodeChange={setNewIso}
            isSigned={newIsSigned}
            onIsSignedChange={setNewIsSigned}
          />
          <Button type="submit" className="self-start">
            Add
          </Button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Edit a language</h3>
        <AutocompleteField
          key={editing?.id ?? "search"}
          label="Find a language"
          kind="language"
          onSelect={(option) => selectForEdit(option as LanguageOption | null)}
        />
        {editing && (
          <form action={updateLanguage} className="mt-3 flex max-w-xl flex-col gap-3">
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
            <LanguageFields
              idPrefix="edit-language"
              isoCode={editIso}
              onIsoCodeChange={setEditIso}
              isSigned={editIsSigned}
              onIsSignedChange={setEditIsSigned}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loadingDetails}>
                {loadingDetails ? "Loading…" : "Save"}
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
