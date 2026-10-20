import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { idFromSlug, slugWithId } from "@/lib/slug";
import { recordPageView, viewPath } from "@/lib/page-views";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { getPlaceChain } from "@/lib/place-chain";
import { groupByContinent } from "@/lib/continents";
import { getSiteUrl } from "@/lib/site-url";
import { CopyTextButton } from "@/components/copy-text-button";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/locale";

type SisterCity = {
  partner_name: string;
  partner_country_iso: string | null;
  partner_place_id: number | null;
  since_year: number | null;
  source: string;
  source_url: string | null;
};

type OriginStat = {
  origin_country_iso: string;
  origin_label: string;
  people: number;
  is_total: boolean;
  source: string;
  period: string;
};

type Consulate = {
  country_iso: string;
  country_name: string;
  mission_type: string | null;
  website: string | null;
  source: string;
  source_url: string | null;
};

type DomesticOrigin = {
  kind: "same_state" | "region";
  label: string;
  people: number;
  source: string;
  period: string;
};

type NetworkRow = {
  id: number;
  title: string;
  member_count: number | null;
  origin_place_id: number | null;
  location_place_id: number;
};

/**
 * A city page.
 *
 * Not a directory of this city's networks - that would lead with the
 * thinnest thing we have, which is the mistake /outposts made before it
 * was restructured. The page is about the CITY, using public data that
 * exists whether or not anyone here has ever signed in, and our own
 * networks sit near the bottom and grow into it.
 *
 * A city is both a destination and an origin, so networks are split:
 * incoming (location is this city) and outgoing (origin is this city).
 * Most cities only ever show one side, and that asymmetry is itself
 * information.
 */
async function loadCity(id: number, locale: Locale) {
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("id, name, type, parent_id, hidden_from_search")
    .eq("id", id)
    .maybeSingle();
  // hidden_from_search covers organisation anchors and test geographies;
  // neither should have a public page about it.
  if (!place || place.hidden_from_search) return null;

  const [
    { data: sisters },
    { data: origins },
    { data: domestic },
    { data: consulates },
    { data: networks },
    chain,
  ] = await Promise.all([
    supabase
      .from("city_sister_cities")
      .select("partner_name, partner_country_iso, partner_place_id, since_year, source, source_url")
      .eq("city_place_id", place.id)
      .order("partner_name"),
    supabase
      .from("city_origin_stats")
      .select("origin_country_iso, origin_label, people, is_total, source, period")
      .eq("city_place_id", place.id)
      .order("people", { ascending: false }),
    supabase
      .from("city_domestic_origins")
      .select("kind, label, people, source, period")
      .eq("city_place_id", place.id)
      .order("people", { ascending: false }),
    supabase
      .from("city_consulates")
      .select("country_iso, country_name, mission_type, website, source, source_url")
      .eq("city_place_id", place.id)
      .order("country_name"),
    supabase
      .from("networks")
      .select("id, title, member_count, origin_place_id, location_place_id")
      .or(`location_place_id.eq.${place.id},origin_place_id.eq.${place.id}`)
      .order("member_count", { ascending: false }),
    getPlaceChain(supabase, Number(place.id), locale),
    ]);

  // Which countries already have a community arriving here?
  //
  // Resolved up the place hierarchy, because an origin can be
  // sub-national: "People from Fujian in New York City" means China is
  // covered, and telling New York it has no Chinese community would be
  // both wrong and the exact opposite of this project's argument that
  // sub-national origin matters.
  const incomingOriginIds = (networks ?? [])
    .filter((n) => n.location_place_id === place.id && n.origin_place_id)
    .map((n) => n.origin_place_id as number);

  const coveredCountryIds = new Set<number>();
  let frontier = incomingOriginIds;
  // Depth 3 covers city -> region -> country, the deepest this data goes.
  for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
    const { data: rows } = await supabase
      .from("places")
      .select("id, type, parent_id")
      .in("id", frontier);
    const next: number[] = [];
    for (const row of rows ?? []) {
      if (row.type === "country") coveredCountryIds.add(row.id as number);
      else if (row.parent_id) next.push(row.parent_id as number);
    }
    frontier = next;
  }

  // Census origins are ISO codes; networks are place ids. The join is the
  // countries table.
  const isoCodes = (origins ?? [])
    .filter((o) => !o.is_total)
    .slice(0, 25)
    .map((o) => o.origin_country_iso);
  const { data: countryPlaces } = isoCodes.length
    ? await supabase
        .from("places")
        .select("id, name, iso_code")
        .eq("type", "country")
        .in("iso_code", isoCodes)
    : { data: [] };
  const placeForIso = new Map(
    (countryPlaces ?? []).map((p) => [p.iso_code as string, p.id as number]),
  );

  return {
    place,
    chain,
    sisters: (sisters ?? []) as SisterCity[],
    origins: (origins ?? []) as OriginStat[],
    domestic: (domestic ?? []) as DomesticOrigin[],
    consulates: (consulates ?? []) as Consulate[],
    networks: (networks ?? []) as NetworkRow[],
    coveredCountryIds,
    placeForIso,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // The route accepts both the bare id and the readable slug that ends
  // in it (lib/slug.ts), so links shared before slugs existed still work.
  const networkId = idFromSlug(id);
  if (networkId === null) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("city");
  const loaded = await loadCity(networkId, locale);
  if (!loaded) return {};

  return shareMetadata({
    title: loaded.chain || (loaded.place.name as string),
    description: previewText(t("metaDescription", { city: loaded.place.name as string })),
    path: `/cities/${slugWithId(loaded.place.name as string, loaded.place.id as number)}`,
  });
}

export default async function CityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The route accepts both the bare id and the readable slug that ends
  // in it (lib/slug.ts), so links shared before slugs existed still work.
  const networkId = idFromSlug(id);
  if (networkId === null) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("city");
  const [loaded, siteUrl] = await Promise.all([loadCity(networkId, locale), getSiteUrl()]);
  if (!loaded) notFound();
  // Recorded per city: the point of these pages is to be found
  // individually, so which ones are found is the whole question.
  recordPageView(viewPath("/cities", slugWithId(loaded.place.name as string, loaded.place.id as number)));

  const { place, chain, sisters, origins, domestic, consulates, networks, coveredCountryIds, placeForIso } =
    loaded;

  const total = origins.find((o) => o.is_total) ?? null;
  const countries = origins.filter((o) => !o.is_total);

  const incoming = networks.filter((n) => n.location_place_id === place.id);
  const outgoing = networks.filter((n) => n.origin_place_id === place.id);

  // The gap: sister-city countries against the countries people actually
  // came from. Computed only when both sides exist, because two thirds of
  // a comparison is not a comparison.
  const partnerCountries = new Set(
    sisters.map((s) => s.partner_country_iso).filter(Boolean) as string[],
  );
  // Compared against the largest communities, not against every country
  // the census lists. The census names about 120 countries, so almost
  // every twin city's country has SOMEBODY here - comparing against the
  // full list made "a partnership and a community here" mean "has at
  // least one resident", which measures nothing. Fifteen is arbitrary but
  // stated on the page rather than hidden in here.
  const TOP_ORIGINS = 15;
  const top = countries.slice(0, TOP_ORIGINS);
  const topIsos = new Set(top.map((c) => c.origin_country_iso));
  const canCompare = partnerCountries.size > 0 && top.length > 0;

  const consulateByIso = new Map(consulates.map((c) => [c.country_iso, c]));
  const partnerOnly = canCompare
    ? sisters.filter((s) => s.partner_country_iso && !topIsos.has(s.partner_country_iso))
    : [];

  // Top origins with people here, a country row we can link to, and no
  // incoming community yet.
  const missing = countries
    .map((c) => ({
      iso: c.origin_country_iso,
      label: c.origin_label,
      people: c.people,
      placeId: placeForIso.get(c.origin_country_iso) ?? null,
    }))
    .filter((c) => c.placeId !== null && !coveredCountryIds.has(c.placeId as number))
    .slice(0, 8) as { iso: string; label: string; people: number; placeId: number }[];

  const sourceNote = sisters[0];

  // Assembled from the sources this page actually carries, so it can
  // never credit a source that is not on the page.
  const citation = [
    `CultureMesh, "${chain || place.name}" city page (${siteUrl}/cities/${place.id}).`,
    countries.length > 0 ? `Foreign-born figures: ${countries[0].source}, ${countries[0].period}.` : null,
    sisters.length > 0 ? `Sister cities: ${sisters[0].source}.` : null,
    consulates.length > 0 ? `Consular missions: ${consulates[0].source}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {chain || (place.name as string)}
        </h1>
        {total && (
          <p className="text-body tabular-nums">
            {t("foreignBorn", { count: total.people })}
          </p>
        )}
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>

      {/* 1. Official statistics. Present for every US city once loaded,
             which is what keeps this page from being empty on day one. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("originsHeading")}</h2>
        {/* Pre-empts the reasonable objection from anyone who knows the
            city was a third German in 1890: this table counts people, not
            descent. */}
        <p className="text-sm text-muted">{t("originsNote")}</p>
        {countries.length === 0 ? (
          <p className="text-sm text-muted">{t("originsPending")}</p>
        ) : (
          <>
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {countries.slice(0, 12).map((c) => (
                <li
                  key={c.origin_country_iso}
                  className="flex justify-between border-b border-border py-1 text-sm"
                >
                  <span className="text-body">{c.origin_label}</span>
                  <span className="text-ink tabular-nums">{c.people.toLocaleString(locale)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              {t("originsSource", { source: countries[0].source, period: countries[0].period })}
            </p>
          </>
        )}
      </section>

      {/* 1b. The domestic half of the same question. Rendered only when
              there is something to render - no equivalent data exists for
              most countries, and an empty section explaining its own
              absence is worse than no section. */}
      {domestic.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">{t("domesticHeading")}</h2>
          <p className="text-sm text-muted">{t("domesticNote")}</p>
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {domestic.map((row) => (
              <li
                key={row.label}
                className="flex justify-between border-b border-border py-1 text-sm"
              >
                <span className="text-body">
                  {row.kind === "same_state"
                    ? t("domesticBornHere", { state: row.label })
                    : /* The four census regions are English administrative
                         terms rather than proper nouns, so unlike country
                         names they are worth translating. */
                      t(`censusRegion.${row.label}`)}
                </span>
                <span className="text-ink tabular-nums">{row.people.toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            {t("domesticSource", { source: domestic[0].source, period: domestic[0].period })}
          </p>
        </section>
      )}

      {/* 2. The civic layer. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("sisterHeading")}</h2>
        {sisters.length === 0 ? (
          <p className="text-sm text-muted">{t("sisterNone")}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {sisters.map((s) => (
                <li
                  key={s.partner_name}
                  className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-body"
                >
                  {/* Linked only when the partner happens to exist in our
                      places data; a partner we can name but not link is
                      still worth showing. */}
                  {s.partner_place_id ? (
                    <Link href={`/cities/${s.partner_place_id}`} className="hover:text-primary">
                      {s.partner_name}
                    </Link>
                  ) : (
                    s.partner_name
                  )}
                  {s.since_year ? <span className="text-muted"> · {s.since_year}</span> : null}
                </li>
              ))}
            </ul>
            {sourceNote && (
              <p className="text-xs text-muted">
                {sourceNote.source_url ? (
                  <a
                    href={sourceNote.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    {t("sisterSource", { source: sourceNote.source })}
                  </a>
                ) : (
                  t("sisterSource", { source: sourceNote.source })
                )}
              </p>
            )}
          </>
        )}
      </section>

      {/* 2b. Official representation. Governments put consulates where
              their nationals are, so this layer tracks population in a
              way twinning does not - and it is the direct counterpart to
              the communities that have no representation and elect an
              Unofficial Consul instead. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("consulHeading")}</h2>
        <p className="text-sm text-muted">{t("consulIntro")}</p>
        {consulates.length === 0 ? (
          <p className="text-sm text-muted">{t("consulNone")}</p>
        ) : (
          <>
            <p className="text-sm text-body tabular-nums">
              {t("consulCount", { count: consulates.length })}
            </p>
            {/* Grouped, because a single alphabetical run of 87 is a
                wall rather than a list. Order and membership follow UN
                M49 (lib/continents.ts). */}
            {groupByContinent(consulates, (c) => c.country_iso).map((group) => (
              <div key={group.continent} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
                  {t(`continent.${group.continent}`)}{" "}
                  <span className="tabular-nums font-normal">({group.items.length})</span>
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {group.items.map((c) => (
                    <li key={c.country_iso}>
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          // nofollow because these URLs come from a
                          // community-edited source, not from us.
                          rel="noopener noreferrer nofollow"
                          title={c.mission_type ?? undefined}
                          className="block rounded-md border border-primary bg-primary-light/50 px-3 py-1 text-sm text-primary hover:bg-primary-light"
                        >
                          {c.country_name}
                        </a>
                      ) : (
                        <span
                          title={c.mission_type ?? undefined}
                          className="block rounded-md border border-border bg-surface px-3 py-1 text-sm text-body"
                        >
                          {c.country_name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted">
              {consulates[0].source_url ? (
                <a
                  href={consulates[0].source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  {t("consulSource", { source: consulates[0].source })}
                </a>
              ) : (
                t("consulSource", { source: consulates[0].source })
              )}
            </p>
          </>
        )}
      </section>

      {/* 3. The comparison. The reason an international-relations officer
             reads this page at all. */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-primary-light/40 p-5">
        <h2 className="font-display text-xl text-ink">{t("gapHeading")}</h2>
        {canCompare && <p className="text-sm text-body">{t("gapIntro", { top: TOP_ORIGINS })}</p>}
        {!canCompare ? (
          <p className="text-sm text-body">{t("gapPending")}</p>
        ) : (
          <>
            {/* A table rather than three prose buckets: an economic
                development office reads down a column, and the three
                signals only mean something next to each other. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colOrigin")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{t("colPeople")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colConsulate")}</th>
                    <th scope="col" className="py-2 font-medium">{t("colTwinned")}</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((c) => {
                    const consulate = consulateByIso.get(c.origin_country_iso);
                    const twinned = partnerCountries.has(c.origin_country_iso);
                    return (
                      <tr key={c.origin_country_iso} className="border-b border-border">
                        <td className="py-2 pr-4 text-ink">{c.origin_label}</td>
                        <td className="py-2 pr-4 text-right text-body tabular-nums">
                          {c.people.toLocaleString(locale)}
                        </td>
                        <td className="py-2 pr-4 text-body">
                          {consulates.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : consulate ? (
                            <span title={consulate.mission_type ?? undefined}>
                              {consulate.mission_type ?? t("markYes")}
                            </span>
                          ) : (
                            <span className="text-muted">{t("markNo")}</span>
                          )}
                        </td>
                        <td className="py-2 text-body">
                          {twinned ? t("markYes") : <span className="text-muted">{t("markNo")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {partnerOnly.length > 0 && (
              <p className="text-sm text-body">
                <span className="font-medium text-ink">{t("gapPartnerOnlyLine")}</span>{" "}
                {partnerOnly.map((s) => s.partner_name).join(" · ")}
              </p>
            )}
            {/* Without this the page reads as an accusation, and an
                accusation does not get forwarded inside a city hall. */}
            <p className="text-xs text-muted">{t("gapCaveat")}</p>
          </>
        )}
      </section>

      {/* 4. Our own layer, split by direction. */}
      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-medium text-ink">{t("networksHeading")}</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
            {t("incomingHeading")}
          </h3>
          {incoming.length === 0 ? (
            <p className="text-sm text-muted">{t("noIncoming")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {incoming.map((n) => (
                <li key={n.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1 text-sm">
                  <Link href={`/networks/${n.id}`} className="text-ink underline hover:text-primary">
                    {n.title}
                  </Link>
                  <span className="text-muted tabular-nums">
                    {n.member_count
                      ? t("memberCount", { count: n.member_count })
                      : t("noMembersYet")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
            {t("outgoingHeading")}
          </h3>
          {outgoing.length === 0 ? (
            <p className="text-sm text-muted">{t("noOutgoing")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {outgoing.map((n) => (
                <li key={n.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1 text-sm">
                  <Link href={`/networks/${n.id}`} className="text-ink underline hover:text-primary">
                    {n.title}
                  </Link>
                  <span className="text-muted tabular-nums">
                    {n.member_count
                      ? t("memberCount", { count: n.member_count })
                      : t("noMembersYet")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Prefills the right side of the search, so the link lands on
              "pick an origin for a community in this city" rather than on
              the suggest-a-missing-geography form - almost every city is
              already in the database. */}
          <Link
            href={`/search/results?locationId=${place.id}&locationQuery=${encodeURIComponent(place.name as string)}`}
            className="text-sm text-primary underline"
          >
            {t("startIncoming", { city: place.name as string })}
          </Link>
          <Link
            href={`/search/results?originId=${place.id}&originQuery=${encodeURIComponent(place.name as string)}`}
            className="text-sm text-primary underline"
          >
            {t("startOutgoing", { city: place.name as string })}
          </Link>
        </div>
      </section>

      {/* The payoff of the census block: a specific, counted, missing
          community, with both sides of the link already filled in. This
          works in a city with no users at all, which is the point. */}
      {missing.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">{t("missingHeading")}</h2>
          <p className="text-sm text-muted">{t("missingIntro")}</p>
          <ul className="flex flex-col gap-1">
            {missing.map((m) => (
              <li
                key={m.iso}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-1 text-sm"
              >
                <span className="text-ink">{m.label}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-muted tabular-nums">
                    {t("missingPeople", { count: m.people })}
                  </span>
                  <Link
                    href={`/search/results?originId=${m.placeId}&originQuery=${encodeURIComponent(m.label)}&locationId=${place.id}&locationQuery=${encodeURIComponent(place.name as string)}`}
                    className="text-primary underline"
                  >
                    {t("missingStart")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Organisations working on this - a Global Detroit, a city office,
          a resettlement agency writing a grant application - need a line
          they can paste. Giving them one costs nothing and is the whole
          reason the sources are kept separate above. */}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 className="text-sm font-medium text-ink">{t("citeHeading")}</h2>
        <p className="text-xs text-muted">{t("citeIntro")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 break-words rounded-md border border-border bg-surface p-2 text-xs text-body">
            {citation}
          </code>
          <CopyTextButton text={citation} />
        </div>
        <p className="text-xs text-muted">{t("sourcesNote")}</p>
      </section>
    </div>
  );
}
