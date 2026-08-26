import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Field, Label, fieldClass } from "@/components/ui/input";

// The main site's search lets you type any language or place - this one
// doesn't. Acme's origin is locked to exactly the 4 languages it offers (a
// plain <select>, not the live-search AutocompleteField everywhere else
// uses) and its location is locked to Acme University outright, with no
// picker for it at all. Posts to the same shared /search/results the rest
// of the site uses - already resolves an exact origin+location pair
// straight to the matching network, no learn.-specific results page
// needed.
export async function LearnSearchForm({ organizationId }: { organizationId: number }) {
  const t = await getTranslations("learn");
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("location_place_id")
    .eq("id", organizationId)
    .single();

  const { data: orgLanguages } = await supabase
    .from("organization_languages")
    .select("language:languages(id, name)")
    .eq("organization_id", organizationId);

  const languages = ((orgLanguages ?? []) as unknown as { language: { id: number; name: string } | null }[])
    .map((row) => row.language)
    .filter((l): l is { id: number; name: string } => l !== null);

  if (!org || languages.length === 0) {
    return null;
  }

  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value="language" />
      <input type="hidden" name="locationId" value={org.location_place_id} />
      <Field>
        <Label htmlFor="learn-language">{t("languageLabel")}</Label>
        <select id="learn-language" name="originId" required className={fieldClass}>
          {languages.map((language) => (
            <option key={language.id} value={language.id}>
              {language.name}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
