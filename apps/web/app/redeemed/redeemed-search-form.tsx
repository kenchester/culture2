import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Origin is fixed to Christian and hidden entirely - unlike faith's
// FaithSearchForm, this subdomain doesn't let the visitor pick a religion
// at all, only where they live.
export function RedeemedSearchForm({ religionId }: { religionId: number }) {
  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value="religion" />
      <input type="hidden" name="originId" value={religionId} />
      <AutocompleteField
        label="Your Location"
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
      />
      <Button type="submit" className="w-full">
        Search
      </Button>
    </form>
  );
}
