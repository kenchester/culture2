import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { idFromSlug, slugWithId } from "@/lib/slug";
import { recordPageView, viewPath } from "@/lib/page-views";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { CommunityNotes } from "@/components/community-notes";
import { LanguagePrompts } from "@/components/language-prompts";
import { censusCoverage, isAtRisk } from "@/lib/language-reference";
import { CopyTextButton } from "@/components/copy-text-button";
import { getSiteUrl } from "@/lib/site-url";
import type { Locale } from "@/lib/locale";

/**
 * A page about a language.
 *
 * The networks have been able to express "Cantonese speakers in Miami"
 * since the first migration, but there has never been a page about
 * Cantonese - and for a language that is losing speakers, that is the
 * page that matters. The people doing revitalisation work are organised
 * around the language itself, scattered across places, and what they need
 * to see first is how many speakers are left and where.
 *
 * Built on the same principle as the city and corridor pages: outside
 * data with its source named, useful to somebody who has never signed in,
 * with our own networks sitting underneath it rather than above. The
 * difference here is that the most important fact on many of these pages
 * is an ABSENCE - the census refuses to count most of these languages
 * separately - and the page is built to state that plainly rather than
 * paper over it with the nearest available number.
 */
type PlaceStat = {
  place_id: number;
  speakers: number;
  limited_english: number | null;
  source: string;
  period: string;
};

async function loadLanguage(id: number) {
  const supabase = await createClient();

  const { data: language } = await supabase
    .from("languages")
    .select(
      "id, name, iso_code, iso639_3, glottocode, glottolog_name, endangerment, endangerment_source, coverage, is_signed",
    )
    .eq("id", id)
    .maybeSingle();
  if (!language) return null;

  const [{ data: labels }, { data: networks }] = await Promise.all([
    supabase
      .from("language_census_labels")
      .select("census_label, is_exact")
      .eq("language_id", language.id),
    supabase
      .from("networks")
      .select("id, title, member_count, location_place_id")
      .eq("language_id", language.id)
      .order("member_count", { ascending: false }),
  ]);

  const coverage = censusCoverage(labels ?? []);

  // Every place that reports this category, biggest first. Fetched by
  // label rather than by language precisely because the label may cover
  // more than this language - the page says which case it is.
  //
  // Not limited to 20: the states are the useful half for most of these
  // languages and there are 50 of them, so a limit here would silently
  // drop the smaller states rather than the less relevant rows.
  const { data: stats } = coverage
    ? await supabase
        .from("place_language_stats")
        .select("place_id, speakers, limited_english, source, period")
        .eq("census_label", coverage.census_label)
        .order("speakers", { ascending: false })
        .limit(200)
    : { data: [] };

  const placeIds = [
    ...new Set([
      ...((stats ?? []).map((s) => s.place_id as number)),
      ...((networks ?? []).map((n) => n.location_place_id as number)),
    ]),
  ];
  const { data: places } = placeIds.length
    ? await supabase.from("places").select("id, name, type, hidden_from_search").in("id", placeIds)
    : { data: [] };
  const placeById = new Map((places ?? []).map((p) => [p.id as number, p]));

  return {
    language,
    coverage,
    stats: ((stats ?? []) as PlaceStat[]).filter(
      (s) => placeById.get(s.place_id) && !placeById.get(s.place_id)!.hidden_from_search,
    ),
    // An organisation's networks are gated and identified by a hidden
    // location, matching app/sitemap.ts.
    networks: (networks ?? []).filter((n) => {
      const place = placeById.get(n.location_place_id as number);
      return place && !place.hidden_from_search;
    }),
    placeById,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const languageId = idFromSlug(id);
  if (languageId === null) notFound();
  const t = await getTranslations("language");
  const loaded = await loadLanguage(languageId);
  if (!loaded) return {};
  const name = loaded.language.name as string;

  return shareMetadata({
    title: name,
    description: previewText(
      isAtRisk(loaded.language.endangerment as string | null)
        ? t("metaAtRisk", { language: name })
        : t("metaDescription", { language: name }),
    ),
    path: `/languages/${slugWithId(name, loaded.language.id as number)}`,
  });
}

export default async function LanguagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const languageId = idFromSlug(id);
  if (languageId === null) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("language");
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const [loaded, siteUrl] = await Promise.all([loadLanguage(languageId), getSiteUrl()]);
  if (!loaded) notFound();

  const { language, coverage, stats, networks, placeById } = loaded;
  const name = language.name as string;
  const slug = slugWithId(name, language.id as number);
  recordPageView(viewPath("/languages", slug));

  const status = language.endangerment as string | null;
  const isGroup = language.coverage === "group";

  const stateRows = stats.filter((s) => placeById.get(s.place_id)?.type === "region");
  const cityRows = stats.filter((s) => placeById.get(s.place_id)?.type === "city");
  const statLists = [
    { kind: "region" as const, rows: stateRows },
    { kind: "city" as const, rows: cityRows },
  ].filter((group) => group.rows.length > 0);

  // Which network a recording would go to: one the viewer has joined, if
  // any. Resolved here rather than in LanguagePrompts so the prompt list
  // stays a presentation component.
  const { data: membership } = viewer && networks.length
    ? await supabase
        .from("network_members")
        .select("network_id")
        .eq("user_id", viewer.id)
        .in("network_id", networks.map((n) => n.id as number))
        .limit(1)
        .maybeSingle()
    : { data: null };

  const citation = [
    `CultureMesh, "${name}" language page (${siteUrl}/languages/${slug}).`,
    status ? `Endangerment status: ${language.endangerment_source}.` : null,
    stats.length > 0 ? `Speakers at home: ${stats[0].source}, ${stats[0].period}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">{name}</h1>
        {/* Glottolog's name, when it differs. Showing both is what lets a
            reader check the status below against the source, and quietly
            renaming a community's language to a linguist's preferred term
            is its own small insult. */}
        {language.glottolog_name && (
          <p className="text-sm text-muted">
            {t("alsoKnown", { name: language.glottolog_name as string })}
          </p>
        )}
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>

      {/* 1. Status. The first thing a revitalisation group looks for, and
             the line that tells them whether this site understands what
             they are doing. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("statusHeading")}</h2>
        {isGroup ? (
          // "Quechua" covers varieties from not endangered to extinct;
          // "Zapotec" is some sixty languages. Picking a representative
          // would print a confident label exactly where the truth is
          // "it depends which one, and that distinction is the subject".
          <p className="text-sm text-body">{t("statusGroup", { language: name })}</p>
        ) : status ? (
          <>
            {/* UNESCO's Atlas wording, not Glottolog's. The database
                stores Glottolog's own vocabulary so a status can be
                checked against its source, but "Moribund" is not a word
                to put in front of a reader - it is opaque in English and
                machine translation rendered it as "dead", "death" and
                "discarded". UNESCO's terms say what they mean and are
                published in many languages. */}
            <p className="text-base font-medium text-ink">{t(`status.${status}`)}</p>
            <p className="text-sm text-muted">{t(`endangermentMeaning.${status}`)}</p>
            <p className="text-xs text-muted">
              {language.glottocode ? (
                <a
                  href={`https://glottolog.org/resource/languoid/id/${language.glottocode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  {t("statusSource", { source: language.endangerment_source as string })}
                </a>
              ) : (
                t("statusSource", { source: language.endangerment_source as string })
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{t("statusUnknown")}</p>
        )}

        {(language.iso639_3 || language.iso_code || language.glottocode) && (
          <p className="text-xs text-muted tabular-nums">
            {[
              language.iso639_3 ? `ISO 639-3 ${language.iso639_3}` : null,
              language.iso_code ? `ISO 639-1 ${language.iso_code}` : null,
              language.glottocode ? `Glottocode ${language.glottocode}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>

      {/* 2. Speakers, and the honesty about what was counted. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("speakersHeading")}</h2>

        {!coverage ? (
          // Sign languages, and anything else B16001 has no bucket for.
          <p className="text-sm text-body">
            {language.is_signed ? t("speakersSigned", { language: name }) : t("speakersNoCategory")}
          </p>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted">{t("speakersPending")}</p>
        ) : (
          <>
            {coverage.is_exact ? (
              <p className="text-sm text-muted">{t("speakersExact", { language: name })}</p>
            ) : (
              // The most important paragraph on most of these pages. The
              // census openly declines to count this language, and the
              // page says so in the place where a reader would otherwise
              // assume the number below is the language's own.
              <p className="rounded-md border border-border bg-primary-light/40 p-3 text-sm text-body">
                {t("speakersLumped", { language: name, category: coverage.census_label })}
              </p>
            )}
            {/* States and cities are separate lists rather than one
                ranked run. The census publishes this table for every
                state but only about fourteen cities, so a single list
                sorted by size would put eleven states, then Houston,
                then more states - implying a comparison between
                geographies that are not comparable, and implying the
                missing cities have no speakers. */}
            {statLists.map(({ kind, rows }) => (
              <div key={kind} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
                  {t(kind === "region" ? "byState" : "byCity")}
                </h3>
                <ul className="flex flex-col gap-1">
                  {rows.map((stat) => {
                    const place = placeById.get(stat.place_id)!;
                    return (
                      <li
                        key={stat.place_id}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-1 text-sm"
                      >
                        <Link
                          href={`/cities/${slugWithId(place.name as string, place.id as number)}`}
                          className="text-ink underline hover:text-primary"
                        >
                          {place.name as string}
                        </Link>
                        <span className="flex items-baseline gap-3 tabular-nums">
                          <span className="text-ink">{stat.speakers.toLocaleString(locale)}</span>
                          {/* The service half of the table. This is the
                              figure a school district or an interpreter
                              office acts on. */}
                          {/* Label and number kept as separate nodes.
                              As one interpolated string this came back
                              from translation as "inglés 5,054
                              limitado" - the figure wedged into the
                              middle of the phrase. */}
                          {stat.limited_english !== null && (
                            <span className="text-muted">
                              {t("limitedEnglishLabel")}{" "}
                              {stat.limited_english.toLocaleString(locale)}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted">
              {t("speakersSource", { source: stats[0].source, period: stats[0].period })}
            </p>
            {/* Said plainly, because the absence looks like a zero
                otherwise: a city missing from the list above is a city
                the Bureau does not publish this table for. */}
            {cityRows.length > 0 && <p className="text-xs text-muted">{t("cityCoverage")}</p>}
          </>
        )}
      </section>

      {/* 3. The recording ask. Collapsed, because most people arriving
             here are reading rather than recording. */}
      <LanguagePrompts
        supabase={supabase}
        languageId={language.id as number}
        networkId={(membership?.network_id as number | undefined) ?? null}
        canPost={Boolean(membership)}
        signInHref={viewer ? "/search" : `/sign-in?returnTo=/languages/${slug}`}
      />

      {/* 4. Our own layer. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("networksHeading")}</h2>
        {networks.length === 0 ? (
          <p className="text-sm text-muted">{t("noNetworks")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {networks.map((n) => (
              <li
                key={n.id as number}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-1 text-sm"
              >
                <Link
                  href={`/networks/${slugWithId(n.title as string, n.id as number)}`}
                  className="text-ink underline hover:text-primary"
                >
                  {n.title as string}
                </Link>
                <span className="text-muted tabular-nums">
                  {n.member_count
                    ? t("memberCount", { count: n.member_count as number })
                    : t("noMembersYet")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/search" className="self-start text-sm text-primary underline">
          {t("startNetwork", { language: name })}
        </Link>
      </section>

      <CommunityNotes
        supabase={supabase}
        languageId={language.id as number}
        returnTo={`/languages/${slug}`}
        signedIn={Boolean(viewer)}
      />

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 className="text-sm font-medium text-ink">{t("citeHeading")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 break-words rounded-md border border-border bg-surface p-2 text-xs text-body">
            {citation}
          </code>
          <CopyTextButton text={citation} />
        </div>
      </section>
    </div>
  );
}
