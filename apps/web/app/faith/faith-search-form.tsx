import { getTranslations } from "next-intl/server";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Simpler than the main site's SearchForm - religion is the only origin
// kind here, so there's no Speak/From-style toggle needed, and no client
// state to manage (plain server component, native form post).
export async function FaithSearchForm() {
  const t = await getTranslations("faith");

  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value="religion" />
      <AutocompleteField
        label={t("religionLabel")}
        kind="religion"
        hiddenName="originId"
        queryName="originQuery"
        placeholder={t("religionPlaceholder")}
      />
      <AutocompleteField
        label={t("locationLabel")}
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
        placeholder={t("locationPlaceholder")}
      />
      <Button type="submit" className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
