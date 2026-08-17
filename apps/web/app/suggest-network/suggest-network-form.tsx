"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { suggestNetwork } from "@/app/suggest-network/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

const PLACE_TYPES = ["city", "region", "country"] as const;

// One submission, not a paired origin+location - a language or a place both
// pull from the same underlying data, so asking for both was redundant.
export function SuggestNetworkForm() {
  const t = useTranslations("suggestNetwork");
  const [kind, setKind] = useState<"language" | "place">("place");

  return (
    <form action={suggestNetwork} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setKind("language")}
          className={`rounded px-3 py-1.5 transition-colors ${
            kind === "language" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          {t("speak")}
        </button>
        <button
          type="button"
          onClick={() => setKind("place")}
          className={`rounded px-3 py-1.5 transition-colors ${
            kind === "place" ? "bg-primary text-white" : "text-body hover:text-primary"
          }`}
        >
          {t("from")}
        </button>
      </div>
      <Field>
        <Label htmlFor="suggestionText">{kind === "language" ? t("language") : t("place")}</Label>
        <Input
          id="suggestionText"
          name="suggestionText"
          placeholder={kind === "language" ? t("languagePlaceholder") : t("placePlaceholder")}
          required
        />
      </Field>
      {kind === "place" && (
        <Field>
          <Label>{t("type")}</Label>
          <div className="flex gap-4 text-sm text-body">
            {PLACE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input type="radio" name="placeType" value={type} required />
                {t(`placeTypes.${type}`)}
              </label>
            ))}
          </div>
        </Field>
      )}
      <Button type="submit" className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
