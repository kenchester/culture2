import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { getPlaceChain } from "@/lib/place-chain";
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
async function loadCity(id: string, locale: Locale) {
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("id, name, type, parent_id, hidden_from_search")
    .eq("id", id)
    .maybeSingle();
  // hidden_from_search covers organisation anchors and test geographies;
  // neither should have a public page about it.
  if (!place || place.hidden_from_search) return null;

  const [{ data: sisters }, { data: origins }, { data: networks }, chain] = await Promise.all([
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
      .from("networks")
      .select("id, title, member_count, origin_place_id, location_place_id")
      .or(`location_place_id.eq.${place.id},origin_place_id.eq.${place.id}`)
      .order("member_count", { ascending: false }),
    getPlaceChain(supabase, Number(place.id), locale),
  ]);

  return {
    place,
    chain,
    sisters: (sisters ?? []) as SisterCity[],
    origins: (origins ?? []) as OriginStat[],
    networks: (networks ?? []) as NetworkRow[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("city");
  const loaded = await loadCity(id, locale);
  if (!loaded) return {};

  return shareMetadata({
    title: loaded.chain || (loaded.place.name as string),
    description: previewText(t("metaDescription", { city: loaded.place.name as string })),
    path: `/cities/${id}`,
  });
}

export default async function CityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("city");
  const loaded = await loadCity(id, locale);
  if (!loaded) notFound();

  const { place, chain, sisters, origins, networks } = loaded;

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
  const originCountries = new Map(countries.map((c) => [c.origin_country_iso, c]));
  const canCompare = partnerCountries.size > 0 && originCountries.size > 0;

  const both = canCompare
    ? [...originCountries.values()].filter((c) => partnerCountries.has(c.origin_country_iso))
    : [];
  const communityOnly = canCompare
    ? [...originCountries.values()].filter((c) => !partnerCountries.has(c.origin_country_iso))
    : [];
  const partnerOnly = canCompare
    ? sisters.filter(
        (s) => s.partner_country_iso && !originCountries.has(s.partner_country_iso),
      )
    : [];

  const sourceNote = sisters[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {chain || (place.name as string)}
        </h1>
        {total && (
          <p className="text-body tabular-nums">
            {t("foreignBorn", { count: total.people.toLocaleString(locale) })}
          </p>
        )}
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>

      {/* 1. Official statistics. Present for every US city once loaded,
             which is what keeps this page from being empty on day one. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("originsHeading")}</h2>
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

      {/* 3. The comparison. The reason an international-relations officer
             reads this page at all. */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-primary-light/40 p-5">
        <h2 className="font-display text-xl text-ink">{t("gapHeading")}</h2>
        {!canCompare ? (
          <p className="text-sm text-body">{t("gapPending")}</p>
        ) : (
          <>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="font-medium text-ink">{t("gapBoth")}</dt>
                <dd className="text-body">
                  {both.length === 0
                    ? t("gapNone")
                    : both.map((c) => c.origin_label).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">{t("gapCommunityOnly")}</dt>
                <dd className="text-body">
                  {communityOnly.length === 0
                    ? t("gapNone")
                    : communityOnly
                        .slice(0, 10)
                        .map((c) => `${c.origin_label} (${c.people.toLocaleString(locale)})`)
                        .join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">{t("gapPartnerOnly")}</dt>
                <dd className="text-body">
                  {partnerOnly.length === 0
                    ? t("gapNone")
                    : partnerOnly.map((s) => s.partner_name).join(" · ")}
                </dd>
              </div>
            </dl>
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

        <Link href="/suggest-network" className="self-start text-sm text-primary underline">
          {t("startOne")}
        </Link>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 className="text-sm font-medium text-ink">{t("sourcesHeading")}</h2>
        <p className="text-xs text-muted">{t("sourcesNote")}</p>
      </section>
    </div>
  );
}
