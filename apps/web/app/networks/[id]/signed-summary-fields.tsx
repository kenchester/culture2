"use client";

import { useTranslations } from "next-intl";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Field, Label, Textarea } from "@/components/ui/input";

// The one text alternative a signed-language video can have. Whisper finds
// no speech in a signed video and sign-language recognition isn't a solved
// problem at any price, so this is necessarily human-written.
//
// Rendered only once the "Add optional summary text" checkbox in
// RecordMedia's controls is ticked - PostComposer owns that state, so the
// panel is a plain always-visible form here with no toggle of its own.
// Deliberately optional and never required: a signed language has no
// written form, so "summarize your video in writing" is really "translate
// your video into a different language". That's real work, and forcing it
// would put friction squarely on the users this feature exists to serve.
//
// The language picker is not optional metadata for the same reason - since
// the summary is a translation, we have to know which language it landed
// in, both so translateEntry has a source language and so the rendered
// text can carry lang= for screen readers. It's an autocomplete over the
// full languages table rather than a select: there are 162 of them, and a
// dropdown that long is worse to use than typing three letters.
export function SignedSummaryFields({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("editableEntry");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <p className="text-xs text-muted">{t("addSummaryHelp")}</p>

      <Field>
        <Label htmlFor={`${idPrefix}-summary`}>{t("summaryLabel")}</Label>
        <Textarea id={`${idPrefix}-summary`} name="summaryText" rows={3} />
      </Field>

      <AutocompleteField
        label={t("summaryLanguageLabel")}
        kind="language"
        hiddenName="summaryLanguageId"
        placeholder={t("summaryLanguagePlaceholder")}
      />
    </div>
  );
}
