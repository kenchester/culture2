import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmbedLocationForm } from "@/app/embed/[partnerSlug]/embed-location-form";
import { EmbedSearchForm } from "@/app/embed/[partnerSlug]/embed-search-form";
import { EmbedLaunchForm } from "@/app/embed/[partnerSlug]/embed-launch-form";
import { AutocompleteField } from "@/components/autocomplete-field";

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
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Resolves one side (origin or location) of a search into candidates: the
// single already-known entity if an id was passed, otherwise guesses from
// typed text - jurisdiction-scoped for a partner's location field, since a
// guess must never suggest somewhere outside what the partner allows.
async function resolveCandidates({
  supabase,
  isLanguage,
  resolvedId,
  resolvedName,
  query,
  partnerSlugForScope,
}: {
  supabase: SupabaseClient;
  isLanguage: boolean;
  resolvedId: number | null;
  resolvedName?: string;
  query?: string;
  partnerSlugForScope?: string;
}): Promise<Candidate[]> {
  if (resolvedId) {
    if (resolvedName) {
      return [{ id: resolvedId, name: resolvedName }];
    }
    const { data } = isLanguage
      ? await supabase.from("languages").select("id, name").eq("id", resolvedId).single()
      : await supabase.from("places").select("id, name").eq("id", resolvedId).single();
    return data ? [{ id: data.id, name: data.name }] : [];
  }
  if (!query) {
    return [];
  }
  if (isLanguage) {
    const { data } = await supabase.rpc("guess_languages", { p_query: query, p_limit: 3 });
    return (data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));
  }
  const { data } = partnerSlugForScope
    ? await supabase.rpc("guess_places_for_partner", {
        p_partner_slug: partnerSlugForScope,
        p_query: query,
        p_limit: 3,
      })
    : await supabase.rpc("guess_places", { p_query: query, p_limit: 3 });
  return (data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerSlug: string }>;
  searchParams: Promise<{
    locationId?: string;
    locationQuery?: string;
    originKind?: string;
    originId?: string;
    originQuery?: string;
  }>;
}) {
  const { partnerSlug } = await params;
  const {
    locationId,
    locationQuery,
    originKind: visitorOriginKind,
    originId: visitorOriginId,
    originQuery,
  } = await searchParams;
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("embed_partners")
    .select(
      "id, name, slug, hide_origin_label, origin_is_global, is_global, join_heading_style, join_heading_group_name, locked_language_id, locked_origin_place_id, locked_language:locked_language_id(name), locked_origin_place:locked_origin_place_id(name), jurisdictions:embed_partner_jurisdictions(place:place_id(name))",
    )
    .eq("slug", partnerSlug)
    .single();

  if (!partner) {
    notFound();
  }

  const globalOrigin = partner.origin_is_global;
  const joinHeading =
    partner.join_heading_style === "diaspora_network"
      ? "Join our diaspora network"
      : partner.join_heading_style === "custom_group"
        ? `Join a local ${partner.join_heading_group_name} network`
        : `Join the local network of ${partner.name}`;

  // Surfaces the partner's jurisdiction restriction (if any) right in the
  // location field's label, so a visitor isn't left guessing why their
  // location search comes up empty for anywhere outside it.
  const jurisdictionNames = (
    partner.jurisdictions as unknown as { place: { name: string } | null }[]
  )
    .map((j) => j.place?.name)
    .filter((name): name is string => Boolean(name));
  const locationLabel =
    partner.is_global || jurisdictionNames.length === 0
      ? "Your Location"
      : `Your Location (within ${jurisdictionNames.join(", ")})`;

  // A global-origin partner has no fixed origin - the visitor's own choice
  // (from the query string) stands in for what would otherwise be the
  // partner's locked language/place.
  const isLanguage = globalOrigin
    ? visitorOriginKind === "language"
    : partner.locked_language_id !== null;
  const originId = globalOrigin
    ? visitorOriginId
      ? Number(visitorOriginId)
      : null
    : (isLanguage ? partner.locked_language_id : partner.locked_origin_place_id);

  let originName = "?";
  if (!globalOrigin) {
    const lockedOrigin = partner.locked_language ?? partner.locked_origin_place;
    originName = (lockedOrigin as unknown as { name: string } | null)?.name ?? "?";
  } else if (originId) {
    const { data: originRow } = await supabase
      .from(isLanguage ? "languages" : "places")
      .select("name")
      .eq("id", originId)
      .single();
    originName = originRow?.name ?? "?";
  }

  const trimmedOriginQuery = originQuery?.trim();
  const trimmedLocationQuery = locationQuery?.trim();

  if (globalOrigin && (!originId || !locationId)) {
    const originGuessable = !originId && Boolean(trimmedOriginQuery);
    const locationGuessable = !locationId && Boolean(trimmedLocationQuery);

    if (!originGuessable && !locationGuessable) {
      return (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
          <h1 className="text-2xl font-semibold text-ink">{joinHeading}</h1>
          <EmbedSearchForm partnerSlug={partnerSlug} locationLabel={locationLabel} />
        </div>
      );
    }

    return renderGuessedCombos({
      supabase,
      partnerSlug,
      isLanguage,
      joinHeading,
      origin: { resolvedId: originId, resolvedName: undefined, query: trimmedOriginQuery },
      location: { resolvedId: locationId ? Number(locationId) : null, query: trimmedLocationQuery },
      scopeLocationToPartner: true,
    });
  }

  if (!globalOrigin && !locationId) {
    if (!trimmedLocationQuery) {
      return (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
          <h1 className="text-2xl font-semibold text-ink">{joinHeading}</h1>
          {!partner.hide_origin_label && (
            <AutocompleteField
              label="Origin"
              kind={isLanguage ? "language" : "place"}
              disabled
              defaultValue={originName}
            />
          )}
          <EmbedLocationForm partnerSlug={partnerSlug} locationLabel={locationLabel} />
        </div>
      );
    }

    return renderGuessedCombos({
      supabase,
      partnerSlug,
      isLanguage,
      joinHeading,
      origin: { resolvedId: originId, resolvedName: originName, query: undefined },
      location: { resolvedId: null, query: trimmedLocationQuery },
      scopeLocationToPartner: true,
    });
  }

  if (!locationId) {
    // Unreachable: both branches above already return whenever locationId
    // is missing. This narrows the type for the code below instead of
    // asserting it.
    notFound();
  }

  const [{ data: location }, { data: matches }] = await Promise.all([
    supabase.from("places").select("name").eq("id", locationId).single(),
    supabase.rpc("search_networks", {
      p_language_id: isLanguage ? originId : null,
      p_origin_place_id: isLanguage ? null : originId,
      p_location_place_id: Number(locationId),
    }),
  ]);

  const results = (matches ?? []) as NetworkMatch[];
  const exact = results.find((m) => m.match_kind === "exact");
  const broader = results.filter((m) => m.match_kind === "related_broader");
  const narrower = results.filter((m) => m.match_kind === "related_narrower");

  const locationName = location?.name ?? "?";
  // A global-origin partner has no branding to imply the origin, so it
  // always shows in results regardless of hide_origin_label - unlike
  // locked mode, where the origin is already implied by the partner
  // itself and hiding it is the whole point of white-labeling.
  const originVisible = globalOrigin || !partner.hide_origin_label;
  const title = originVisible
    ? isLanguage
      ? `${originName} speakers in ${locationName}`
      : `People from ${originName} in ${locationName}`
    : locationName;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <Link href={`/embed/${partnerSlug}`} className="text-sm text-muted underline">
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      </div>

      {exact ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <Link
            href={`/networks/${exact.network_id}?embed=1`}
            className="text-lg font-medium text-ink underline"
          >
            {exact.network_title}
          </Link>
          <p className="text-sm text-muted">
            {exact.member_count} members, {exact.post_count} posts
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-body">No network exists yet for this location.</p>
          <EmbedLaunchForm
            originKind={isLanguage ? "language" : "place"}
            originId={originId ?? 0}
            locationId={locationId}
            title={
              isLanguage
                ? `${originName} speakers in ${locationName}`
                : `People from ${originName} in ${locationName}`
            }
          />
        </section>
      )}

      {broader.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Related (broader)</h2>
          {broader.map((m) => (
            <Link
              key={m.network_id}
              href={`/networks/${m.network_id}?embed=1`}
              className="text-ink underline"
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
              href={`/networks/${m.network_id}?embed=1`}
              className="text-ink underline"
            >
              {m.network_title}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

// Renders the "Networks to Join" fallback when the visitor's typed text
// didn't get resolved to a confirmed origin/location via the dropdown -
// guesses candidates for whichever side is missing and offers every
// origin x location combination, same pattern as the main site's
// /search/results guessing path.
async function renderGuessedCombos({
  supabase,
  partnerSlug,
  isLanguage,
  joinHeading,
  origin,
  location,
  scopeLocationToPartner,
}: {
  supabase: SupabaseClient;
  partnerSlug: string;
  isLanguage: boolean;
  joinHeading: string;
  origin: { resolvedId: number | null; resolvedName?: string; query?: string };
  location: { resolvedId: number | null; query?: string };
  scopeLocationToPartner?: boolean;
}) {
  const backHref = `/embed/${partnerSlug}`;

  const originCandidates = await resolveCandidates({
    supabase,
    isLanguage,
    resolvedId: origin.resolvedId,
    resolvedName: origin.resolvedName,
    query: origin.query,
  });
  const locationCandidates = await resolveCandidates({
    supabase,
    isLanguage: false,
    resolvedId: location.resolvedId,
    query: location.query,
    partnerSlugForScope: scopeLocationToPartner ? partnerSlug : undefined,
  });

  if (originCandidates.length === 0 || locationCandidates.length === 0) {
    const failedQuery = originCandidates.length === 0 ? origin.query : location.query;
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-semibold text-ink">{joinHeading}</h1>
        <p className="text-body">We couldn&rsquo;t find a match for &ldquo;{failedQuery}&rdquo;.</p>
        <Link href={backHref} className="text-primary underline">
          Try again
        </Link>
      </div>
    );
  }

  const combos = originCandidates.flatMap((o) =>
    locationCandidates.map((l) => ({ origin: o, location: l })),
  );

  const existingNetworks = await Promise.all(
    combos.map(({ origin: o, location: l }) =>
      supabase
        .from("networks")
        .select("id, title, member_count, post_count")
        .eq("location_place_id", l.id)
        .eq(isLanguage ? "language_id" : "origin_place_id", o.id)
        .maybeSingle(),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Link href={backHref} className="text-sm text-muted underline">
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-ink">Networks to Join</h1>
        <p className="text-body">
          We weren&rsquo;t sure exactly what you meant &mdash; here are the closest
          matches. Pick the one you were looking for.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {combos.map(({ origin: o, location: l }, i) => {
          const title = isLanguage
            ? `${o.name} speakers in ${l.name}`
            : `People from ${o.name} in ${l.name}`;
          const existing = existingNetworks[i].data as ExistingNetwork | null;

          return (
            <section
              key={`${o.id}-${l.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              {existing ? (
                <>
                  <Link
                    href={`/networks/${existing.id}?embed=1`}
                    className="text-lg font-medium text-ink underline"
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
                  <EmbedLaunchForm
                    originKind={isLanguage ? "language" : "place"}
                    originId={o.id}
                    locationId={String(l.id)}
                    title={title}
                  />
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
