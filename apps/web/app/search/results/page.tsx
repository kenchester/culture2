import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { launchNetwork } from "@/app/search/actions";

type SearchResultsParams = {
  originKind?: string;
  originId?: string;
  locationId?: string;
};

type NetworkMatch = {
  match_kind: "exact" | "related_broader" | "related_narrower";
  network_id: number;
  network_title: string;
  location_place_id: number;
  location_name: string;
  location_type: "country" | "region" | "city";
  member_count: number;
  post_count: number;
};

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchResultsParams>;
}) {
  const { originKind, originId, locationId } = await searchParams;

  if (!originId || !locationId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        Missing search parameters.{" "}
        <Link href="/search" className="underline">
          Try again
        </Link>
        .
      </div>
    );
  }

  const isLanguage = originKind === "language";
  const supabase = await createClient();

  const [{ data: origin }, { data: location }, { data: matches, error }] =
    await Promise.all([
      isLanguage
        ? supabase.from("languages").select("id, name").eq("id", originId).single()
        : supabase.from("places").select("id, name, type").eq("id", originId).single(),
      supabase.from("places").select("id, name, type").eq("id", locationId).single(),
      supabase.rpc("search_networks", {
        p_language_id: isLanguage ? Number(originId) : null,
        p_origin_place_id: isLanguage ? null : Number(originId),
        p_location_place_id: Number(locationId),
      }),
    ]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        Something went wrong: {error.message}
      </div>
    );
  }

  const results = (matches ?? []) as NetworkMatch[];
  const exact = results.find((m) => m.match_kind === "exact");
  const broader = results.filter((m) => m.match_kind === "related_broader");
  const narrower = results.filter((m) => m.match_kind === "related_narrower");

  const originName = origin?.name ?? "?";
  const locationName = location?.name ?? "?";
  const title = isLanguage
    ? `${originName} speakers in ${locationName}`
    : `People from ${originName} in ${locationName}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>

      {exact ? (
        <section className="flex flex-col gap-2 rounded border p-4">
          <Link
            href={`/networks/${exact.network_id}`}
            className="text-lg font-medium underline"
          >
            {exact.network_title}
          </Link>
          <p className="text-sm text-zinc-600">
            {exact.member_count} members, {exact.post_count} posts
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded border p-4">
          <p>No network exists yet for this combination.</p>
          <form action={launchNetwork}>
            <input type="hidden" name="originKind" value={originKind} />
            <input type="hidden" name="originId" value={originId} />
            <input type="hidden" name="locationId" value={locationId} />
            <input type="hidden" name="title" value={title} />
            <button type="submit" className="rounded bg-black px-3 py-2 text-white">
              Launch this network
            </button>
          </form>
        </section>
      )}

      {broader.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-600">Related (broader)</h2>
          {broader.map((m) => (
            <Link key={m.network_id} href={`/networks/${m.network_id}`} className="underline">
              {m.network_title}
            </Link>
          ))}
        </section>
      )}

      {narrower.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-600">Related (narrower)</h2>
          {narrower.map((m) => (
            <Link key={m.network_id} href={`/networks/${m.network_id}`} className="underline">
              {m.network_title}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
