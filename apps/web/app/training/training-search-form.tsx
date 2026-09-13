"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Field, fieldClass, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export type LocationOption = { id: number; name: string };

/**
 * Finds (or offers to launch) a training network.
 *
 * A plain GET form pointed at the existing results page rather than a
 * bespoke flow - joining and launching already work there, and duplicating
 * them here would mean two implementations of the same thing drifting
 * apart. target="_blank" because this page is reference material someone
 * comes back to; sending them away from the rules they are meant to follow
 * would be the wrong trade.
 *
 * Origin is fixed to "language" with no toggle, and location is a closed
 * list, so the URL this produces can only ever describe a
 * language + US state network.
 */
export function TrainingSearchForm({ locations }: { locations: LocationOption[] }) {
  const t = useTranslations("training");
  const [locationId, setLocationId] = useState("");

  return (
    <form
      action="/search/results"
      method="get"
      target="_blank"
      rel="noopener"
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="originKind" value="language" />

      <AutocompleteField
        label={t("languageLabel")}
        kind="language"
        hiddenName="originId"
        queryName="originQuery"
      />

      <Field>
        <Label htmlFor="training-location">{t("locationLabel")}</Label>
        <select
          id="training-location"
          name="locationId"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className={fieldClass}
          required
        >
          <option value="" disabled>
            {t("locationPlaceholder")}
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </Field>

      <SubmitButton className="self-start">{t("submit")}</SubmitButton>
    </form>
  );
}
