import { getTranslations } from "next-intl/server";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Origin is fixed to Christian and hidden entirely - unlike faith's
// FaithSearchForm, this subdomain doesn't let the visitor pick a religion
// at all, only where they live.
export async function RedeemedSearchForm({ religionId }: { religionId: number }) {
  const t = await getTranslations("redeemed");

  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value="religion" />
      <input type="hidden" name="originId" value={religionId} />
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
