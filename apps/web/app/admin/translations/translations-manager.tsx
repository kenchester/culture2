"use client";

import { useState, useTransition } from "react";
import { AutocompleteField, type PlaceOption, type LanguageOption } from "@/components/autocomplete-field";
import { LOCALE_LABELS } from "@/lib/locale";
import {
  getTranslationsForEntity,
  type EntityTranslations,
  type TranslationRow,
} from "@/app/admin/translations/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

const SOURCE_LABEL: Record<NonNullable<TranslationRow["source"]>, string> = {
  cldr: "Standard",
  azure: "Auto-translated",
  manual: "Manual override",
};

type Selected = { kind: "place" | "language"; id: number; name: string };

export function TranslationsManager({
  saveTranslations,
}: {
  saveTranslations: (formData: FormData) => void;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [data, setData] = useState<EntityTranslations | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isoCode, setIsoCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function select(kind: "place" | "language", option: PlaceOption | LanguageOption | null) {
    setData(null);
    if (!option) {
      setSelected(null);
      return;
    }
    setSelected({ kind, id: option.id, name: option.name });
    startTransition(async () => {
      const result = await getTranslationsForEntity(kind, option.id);
      setData(result);
      setIsoCode(result.isoCode ?? "");
      setValues(Object.fromEntries(result.translations.map((row) => [row.locale, row.value])));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Find a language</h3>
        <AutocompleteField
          key={`lang-${selected?.kind === "language" ? selected.id : "search"}`}
          label="Language"
          kind="language"
          onSelect={(option) => select("language", option as LanguageOption | null)}
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Find a place</h3>
        <AutocompleteField
          key={`place-${selected?.kind === "place" ? selected.id : "search"}`}
          label="Country, region, or city"
          kind="place"
          onSelect={(option) => select("place", option as PlaceOption | null)}
        />
      </div>

      {isPending && <p className="text-sm text-muted">Loading translations…</p>}

      {selected && data && !isPending && (
        <form
          action={saveTranslations}
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
        >
          <input type="hidden" name="kind" value={selected.kind} />
          <input type="hidden" name="id" value={selected.id} />
          <h3 className="font-medium text-ink">
            {selected.name}{" "}
            <span className="text-sm font-normal text-muted">
              ({selected.kind}
              {data.placeType ? `, ${data.placeType}` : ""})
            </span>
          </h3>

          <Field>
            <Label htmlFor="isoCode">
              ISO code{" "}
              <span className="font-normal text-muted">
                (optional - {selected.kind === "language" ? "ISO 639-1" : "ISO 3166-1, countries only"})
              </span>
            </Label>
            <Input
              id="isoCode"
              name="isoCode"
              value={isoCode}
              onChange={(e) => setIsoCode(e.target.value)}
              placeholder={selected.kind === "language" ? "e.g. es" : "e.g. US"}
            />
          </Field>

          <div className="flex flex-col gap-3">
            {data.translations.map((row) => (
              <Field key={row.locale}>
                <Label htmlFor={`value_${row.locale}`}>
                  {LOCALE_LABELS[row.locale]}
                  {row.source && (
                    <span className="ml-2 text-xs font-normal text-muted">
                      ({SOURCE_LABEL[row.source]})
                    </span>
                  )}
                </Label>
                {/* Lets the save action tell an intentional edit apart
                    from a field the admin never touched - only a real
                    change should become a sticky "manual" override, not
                    every already-correct value that happened to be
                    visible on the form at save time. */}
                <input type="hidden" name={`original_${row.locale}`} value={row.value} />
                <Input
                  id={`value_${row.locale}`}
                  name={`value_${row.locale}`}
                  value={values[row.locale] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [row.locale]: e.target.value }))}
                />
              </Field>
            ))}
          </div>

          <Button type="submit" className="self-start">
            Save
          </Button>
        </form>
      )}
    </div>
  );
}
