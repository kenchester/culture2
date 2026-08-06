import { suggestNetwork } from "@/app/suggest-network/actions";

export default async function SuggestNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Suggest a network</h1>
        <p className="text-sm text-zinc-600">
          Can&apos;t find the language or place you&apos;re looking for in search?
          Tell us what you&apos;d like to see and we&apos;ll take a look.
        </p>
      </div>
      {sent && (
        <p className="text-sm text-green-700">
          Thanks! We&apos;ll review your suggestion.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={suggestNetwork} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="originText" className="text-sm font-medium">
            Language or origin
          </label>
          <input
            id="originText"
            name="originText"
            placeholder="e.g. Tagalog"
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="locationText" className="text-sm font-medium">
            Location
          </label>
          <input
            id="locationText"
            name="locationText"
            placeholder="e.g. Austin, Texas"
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Submit suggestion
        </button>
      </form>
    </div>
  );
}
