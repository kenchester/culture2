"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, fieldClass, Label, Textarea } from "@/components/ui/input";

// The one text alternative a signed-language video can have. Whisper finds
// no speech in a signed video and sign-language recognition isn't a solved
// problem at any price, so this is necessarily human-written.
//
// Deliberately opt-in behind a checkbox, and never required. A signed
// language has no written form, so "summarize your video in writing" is
// really "translate your video into a different language" - real work, not
// a caption. Forcing it would add friction squarely onto the users this
// feature exists to serve, and a coerced one-word summary is worse than
// none at all.
//
// The language picker isn't optional metadata for the same reason: since
// the summary is a translation, we have to know which language it landed
// in - both so translateEntry has a source language and so the rendered
// text can carry lang= for screen readers.
export function SignedSummaryFields({
  idPrefix,
  languages,
}: {
  idPrefix: string;
  languages: { id: number; name: string }[];
}) {
  const t = useTranslations("editableEntry");
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <label className="flex items-start gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1"
        />
        <span>
          {t("addSummary")}
          <span className="mt-0.5 block text-xs text-muted">{t("addSummaryHelp")}</span>
        </span>
      </label>

      {enabled && (
        <>
          <Field>
            <Label htmlFor={`${idPrefix}-summary`}>{t("summaryLabel")}</Label>
            <Textarea id={`${idPrefix}-summary`} name="summaryText" rows={3} />
          </Field>
          <Field>
            <Label htmlFor={`${idPrefix}-summary-language`}>{t("summaryLanguageLabel")}</Label>
            <select
              id={`${idPrefix}-summary-language`}
              name="summaryLanguageId"
              className={fieldClass}
              defaultValue=""
              required
            >
              <option value="" disabled>
                —
              </option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
    </div>
  );
}
