"use client";

import { useTranslations } from "next-intl";
import { searchFromDescription } from "@/app/search/actions";
import { Field, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * The alternative to picking an origin and a location out of two
 * dropdowns: just say it.
 *
 * Plain server-action form, no client state, matching the rest of this
 * app's simple forms (contact, suggest-network). searchFromDescription
 * does one LLM call to pull out the same two fields SearchForm collects,
 * then lands on the exact same /search/results page SearchForm does - a
 * person who starts here and one who starts there see identical results,
 * identical "launch this network" buttons, identical everything after
 * this one step.
 */
export function DescribeYourselfForm() {
  const t = useTranslations("search");

  return (
    <form action={searchFromDescription} className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="describe-text">{t("describeLabel")}</Label>
        <Textarea
          id="describe-text"
          name="description"
          rows={3}
          placeholder={t("describePlaceholder")}
          required
        />
      </Field>
      {/* No pendingLabel - falls back to SubmitButton's own
          t("common.loading"), which is already proven correct across all
          ten locales (it ships on dozens of other buttons already).
          Every custom pending-state wording tried here - "Reading
          that…", "Searching…" - broke differently in a different locale
          each time: a verb needing a subject some languages must mark
          and machine translation kept marking as first person
          ("Cherche" = "I search", "Ищу" = "I am searching"), or the
          wrong sense of an ambiguous word (수색 = investigative/rescue
          search, not an information search). "Loading" survives because
          it is a noun in every one of these translations, not a
          conjugated verb - there is no subject to get wrong. */}
      <SubmitButton className="self-start">
        {t("describeSubmit")}
      </SubmitButton>
    </form>
  );
}
