import { suggestNetwork } from "@/app/suggest-network/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export default async function SuggestNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-2xl text-ink">Suggest a network</h1>
        <p className="mt-1 text-sm text-muted">
          Can&apos;t find the language or place you&apos;re looking for in search?
          Tell us what you&apos;d like to see and we&apos;ll take a look.
        </p>
      </div>
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        {sent && (
          <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
            Thanks! We&apos;ll review your suggestion.
          </p>
        )}
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form action={suggestNetwork} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="originText">Language or origin</Label>
            <Input id="originText" name="originText" placeholder="e.g. Tagalog" required />
          </Field>
          <Field>
            <Label htmlFor="locationText">Location</Label>
            <Input
              id="locationText"
              name="locationText"
              placeholder="e.g. Austin, Texas"
              required
            />
          </Field>
          <Button type="submit" className="w-full">
            Submit suggestion
          </Button>
        </form>
      </div>
    </div>
  );
}
