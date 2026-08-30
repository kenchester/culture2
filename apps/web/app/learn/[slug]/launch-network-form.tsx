import { getTranslations } from "next-intl/server";
import { launchLanguageNetwork } from "@/app/learn/[slug]/actions";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Real schools (unlike Acme's fixed 4-language demo) aren't limited to a
// pre-set list - any recognized member can search the full language list
// and start a network on the spot for one their school doesn't have yet.
// Destination is the org itself, not shown as a picker - a school's page
// only ever launches networks anchored to its own location.
export async function LaunchNetworkForm({ organizationId, slug }: { organizationId: number; slug: string }) {
  const t = await getTranslations("learn");

  return (
    <form action={launchLanguageNetwork} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />
      <AutocompleteField label={t("languageLabel")} kind="language" hiddenName="languageId" />
      <Button type="submit" className="w-full">
        {t("launchNetworkSubmit")}
      </Button>
    </form>
  );
}
