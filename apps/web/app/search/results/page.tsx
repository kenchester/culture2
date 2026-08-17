import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { launchNetwork } from "@/app/search/actions";
import { Button } from "@/components/ui/button";

type ResultsT = Awaited<ReturnType<typeof getTranslations>>;

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

function MissingParamsMessage({ message, tryAgain }: { message: string; tryAgain: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-body">
      {message}{" "}
      <Link href="/search" className="text-primary underline">
        {tryAgain}
      </Link>
      .
    </div>
  );
}

// The origin title/table/RPC choice is now a 3-way switch (language,
// place, or religion) rather than a boolean - originKind drives which
// table an id resolves against, which guess_* RPC a typed query falls
// back to, and which network column an exact match is checked against.
function originTable(originKind: string | undefined) {
  if (originKind === "language") return "languages";
  if (originKind === "religion") return "religions";
  return "places";
}

function originNetworkColumn(originKind: string | undefined) {
  if (originKind === "language") return "language_id";
  if (originKind === "religion") return "religion_id";
  return "origin_place_id";
}

function buildTitle(
  t: ResultsT,
  originKind: string | undefined,
  originName: string,
  locationName: string,
) {
  if (originKind === "language") {
    return t("titleLanguage", { origin: originName, location: locationName });
  }
  if (originKind === "religion") {
    return t("titleReligion", { origin: originName, location: locationName });
  }
  return t("titlePlace", { origin: originName, location: locationName });
}

async function guessOriginCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  originKind: string | undefined,
  query: string,
): Promise<Candidate[]> {
  const rpcName =
    originKind === "language" ? "guess_languages" : originKind === "religion" ? "guess_religions" : "guess_places";
  const { data } = await supabase.rpc(rpcName, { p_query: query, p_limit: 3 });
  return (data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));
}

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchResultsParams>;
}) {
  const { originKind, originId, originQuery, locationId, locationQuery } = await searchParams;
  const isLanguage = originKind === "language";
  const isReligion = originKind === "religion";
  const supabase = await createClient();
  const t = await getTranslations("searchResults");

  // Both sides were resolved via an autocomplete selection - the original,
  // unambiguous single-result flow, unchanged.
  if (originId && locationId) {
    const [{ data: origin }, { data: location }, { data: matches, error }] =
      await Promise.all([
        supabase.from(originTable(originKind)).select("id, name").eq("id", originId).single(),
        supabase.from("places").select("id, name, type").eq("id", locationId).single(),
        supabase.rpc("search_networks", {
          p_language_id: isLanguage ? Number(originId) : null,
          p_origin_place_id: !isLanguage && !isReligion ? Number(originId) : null,
          p_religion_id: isReligion ? Number(originId) : null,
          p_location_place_id: Number(locationId),
        }),
      ]);

    if (error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-12 text-body">
          {t("somethingWentWrong", { message: error.message })}
        </div>
      );
    }

    const results = (matches ?? []) as NetworkMatch[];
    const exact = results.find((m) => m.match_kind === "exact");
    const broader = results.filter((m) => m.match_kind === "related_broader");
    const narrower = results.filter((m) => m.match_kind === "related_narrower");

    const originName = origin?.name ?? "?";
    const locationName = location?.name ?? "?";
    const title = buildTitle(t, originKind, originName, locationName);

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
              {t("memberPostCounts", { members: exact.member_count, posts: exact.post_count })}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-body">{t("noNetworkYet")}</p>
            <form action={launchNetwork}>
              <input type="hidden" name="originKind" value={originKind} />
              <input type="hidden" name="originId" value={originId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="title" value={title} />
              <Button type="submit">{t("launchNetwork")}</Button>
            </form>
          </section>
        )}

        {broader.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted">{t("relatedBroader")}</h2>
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
            <h2 className="text-sm font-medium text-muted">{t("relatedNarrower")}</h2>
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
    return <MissingParamsMessage message={t("missingOrigin")} tryAgain={t("tryAgain")} />;
  }
  if (!locationId && !trimmedLocationQuery) {
    return <MissingParamsMessage message={t("missingLocation")} tryAgain={t("tryAgain")} />;
  }

  const originCandidates: Candidate[] = originId
    ? await (async () => {
        const { data } = await supabase
          .from(originTable(originKind))
          .select("id, name")
          .eq("id", originId)
          .single();
        return data ? [{ id: data.id, name: data.name }] : [];
      })()
    : await guessOriginCandidates(supabase, originKind, trimmedOriginQuery!);

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
    return (
      <MissingParamsMessage
        message={t("noMatchFor", { query: trimmedOriginQuery! })}
        tryAgain={t("tryAgain")}
      />
    );
  }
  if (locationCandidates.length === 0) {
    return (
      <MissingParamsMessage
        message={t("noMatchFor", { query: trimmedLocationQuery! })}
        tryAgain={t("tryAgain")}
      />
    );
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
        .eq(originNetworkColumn(originKind), origin.id)
        .maybeSingle(),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-ink">{t("networksToJoin")}</h1>
        <p className="text-body">{t("notSureWhatYouMeant")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {combos.map(({ origin, location }, i) => {
          const title = buildTitle(t, originKind, origin.name, location.name);
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
                    {t("memberPostCounts", {
                      members: existing.member_count,
                      posts: existing.post_count,
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-ink">{title}</p>
                  <p className="text-sm text-muted">{t("noNetworkYet")}</p>
                  <form action={launchNetwork} className="mt-1">
                    <input type="hidden" name="originKind" value={originKind} />
                    <input type="hidden" name="originId" value={origin.id} />
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="title" value={title} />
                    <Button type="submit">{t("launchNetwork")}</Button>
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
