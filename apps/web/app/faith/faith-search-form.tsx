import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";

// Simpler than the main site's SearchForm - religion is the only origin
// kind here, so there's no Speak/From-style toggle needed, and no client
// state to manage (plain server component, native form post).
export function FaithSearchForm() {
  return (
    <form action="/search/results" className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value="religion" />
      <AutocompleteField
        label="Religion"
        kind="religion"
        hiddenName="originId"
        queryName="originQuery"
        placeholder="e.g. Christian"
      />
      <AutocompleteField
        label="Your Location"
        kind="place"
        hiddenName="locationId"
        queryName="locationQuery"
        placeholder="e.g. Detroit, Michigan"
      />
      <Button type="submit" className="w-full">
        Search
      </Button>
    </form>
  );
}
