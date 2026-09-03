"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AutocompleteField } from "@/components/autocomplete-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function SearchForm() {
  const t = useTranslations("search");
  const [originKind, setOriginKind] = useState<"place" | "language">("place");

  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value={originKind} />
      <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setOriginKind("language")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "language"
              ? "bg-primary text-white"
              : "text-body hover:text-primary"
          }`}
        >
          {t("speak")}
        </button>
        <button
          type="button"
          onClick={() => setOriginKind("place")}
          className={`rounded px-3 py-1.5 transition-colors ${
            originKind === "place"
              ? "bg-primary text-white"
              : "text-body hover:text-primary"
          }`}
        >
          {t("from")}
        </button>
      </div>
      <AutocompleteField
        key={originKind}
        label={originKind === "language" ? t("language") : t("originPlace")}
        kind={originKind}
        hiddenName="originId"
        queryName="originQuery"
        placeholder={originKind === "place" ? t("originPlacePlaceholder") : undefined}
      />
      <AutocompleteField
        label={t("location")}
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
        placeholder={t("locationPlaceholder")}
      />
      <SubmitButton className="w-full">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
