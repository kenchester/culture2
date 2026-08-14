import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { launchNetwork } from "@/app/search/actions";
import { Button } from "@/components/ui/button";

type SearchResultsParams = {
  originKind?: string;
  originId?: string;
  originQuery?: string;
  locationId?: string;
  locationQuery?: string;
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

type Candidate = { id: number; name: string };
type ExistingNetwork = { id: number; title: string; member_count: number; post_count: number };

function MissingParamsMessage({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-body">
      {message}{" "}
      <Link href="/search" className="text-primary underline">
        Try again
      </Link>
      .
    </div>
  );
}

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchResultsParams>;
}) {
  const { originKind, originId, originQuery, locationId, locationQuery } = await searchParams;
  const isLanguage = originKind === "language";
  const supabase = await createClient();

  // Both sides were resolved via an autocomplete selection - the original,
  // unambiguous single-result flow, unchanged.
  if (originId && locationId) {
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
        <div className="mx-auto max-w-lg px-4 py-12 text-body">
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
        <h1 className="font-display text-3xl text-ink">{title}</h1>

        {exact ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <Link
              href={`/networks/${exact.network_id}`}
              className="text-lg font-medium text-ink underline hover:text-primary"
            >
              {exact.network_title}
            </Link>
            <p className="text-sm text-muted">
              {exact.member_count} members, {exact.post_count} posts
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-body">No network exists yet for this combination.</p>
            <form action={launchNetwork}>
              <input type="hidden" name="originKind" value={originKind} />
              <input type="hidden" name="originId" value={originId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="title" value={title} />
              <Button type="submit">Launch this network</Button>
            </form>
          </section>
        )}

        {broader.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted">Related (broader)</h2>
            {broader.map((m) => (
              <Link
                key={m.network_id}
                href={`/networks/${m.network_id}`}
                className="text-ink underline hover:text-primary"
              >
                {m.network_title}
              </Link>
            ))}
          </section>
        )}

        {narrower.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted">Related (narrower)</h2>
            {narrower.map((m) => (
              <Link
                key={m.network_id}
                href={`/networks/${m.network_id}`}
                className="text-ink underline hover:text-primary"
              >
                {m.network_title}
              </Link>
            ))}
          </section>
        )}
      </div>
    );
  }

  // At least one side was never resolved to an id. If we don't even have
  // typed text to guess from for that side, there's nothing to offer.
  const trimmedOriginQuery = originQuery?.trim();
  const trimmedLocationQuery = locationQuery?.trim();

  if (!originId && !trimmedOriginQuery) {
    return <MissingParamsMessage message="Missing an origin to search for." />;
  }
  if (!locationId && !trimmedLocationQuery) {
    return <MissingParamsMessage message="Missing a location to search for." />;
  }

  const originCandidates: Candidate[] = originId
    ? await (async () => {
        const { data } = isLanguage
          ? await supabase.from("languages").select("id, name").eq("id", originId).single()
          : await supabase.from("places").select("id, name").eq("id", originId).single();
        return data ? [{ id: data.id, name: data.name }] : [];
      })()
    : isLanguage
      ? ((await supabase.rpc("guess_languages", { p_query: trimmedOriginQuery, p_limit: 3 }))
          .data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }))
      : ((await supabase.rpc("guess_places", { p_query: trimmedOriginQuery, p_limit: 3 }))
          .data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));

  const locationCandidates: Candidate[] = locationId
    ? await (async () => {
        const { data } = await supabase
          .from("places")
          .select("id, name")
          .eq("id", locationId)
          .single();
        return data ? [{ id: data.id, name: data.name }] : [];
      })()
    : ((await supabase.rpc("guess_places", { p_query: trimmedLocationQuery, p_limit: 3 })).data ??
        []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));

  if (originCandidates.length === 0) {
    return <MissingParamsMessage message={`We couldn't find a match for "${trimmedOriginQuery}".`} />;
  }
  if (locationCandidates.length === 0) {
    return <MissingParamsMessage message={`We couldn't find a match for "${trimmedLocationQuery}".`} />;
  }

  const combos = originCandidates.flatMap((origin) =>
    locationCandidates.map((location) => ({ origin, location })),
  );

  const existingNetworks = await Promise.all(
    combos.map(({ origin, location }) =>
      supabase
        .from("networks")
        .select("id, title, member_count, post_count")
        .eq("location_place_id", location.id)
        .eq(isLanguage ? "language_id" : "origin_place_id", origin.id)
        .maybeSingle(),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-ink">Networks to Join</h1>
        <p className="text-body">
          We weren&rsquo;t sure exactly what you meant &mdash; here are the closest
          matches. Pick the one you were looking for.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {combos.map(({ origin, location }, i) => {
          const title = isLanguage
            ? `${origin.name} speakers in ${location.name}`
            : `People from ${origin.name} in ${location.name}`;
          const existing = existingNetworks[i].data as ExistingNetwork | null;

          return (
            <section
              key={`${origin.id}-${location.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              {existing ? (
                <>
                  <Link
                    href={`/networks/${existing.id}`}
                    className="text-lg font-medium text-ink underline hover:text-primary"
                  >
                    {title}
                  </Link>
                  <p className="text-sm text-muted">
                    {existing.member_count} members, {existing.post_count} posts
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-ink">{title}</p>
                  <p className="text-sm text-muted">No network exists yet for this combination.</p>
                  <form action={launchNetwork} className="mt-1">
                    <input type="hidden" name="originKind" value={originKind} />
                    <input type="hidden" name="originId" value={origin.id} />
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="title" value={title} />
                    <Button type="submit">Launch this network</Button>
                  </form>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
