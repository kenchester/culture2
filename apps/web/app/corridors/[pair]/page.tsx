import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { corridorIdsFromSlug, corridorSlug, slugWithId } from "@/lib/slug";
import { getCorridorContext, type CorridorContext } from "@/lib/corridor-context";
import { CorridorContextBlock } from "@/app/networks/[id]/corridor-context-block";
import type { Locale } from "@/lib/locale";

type NetworkRow = { id: number; title: string; member_count: number | null };

/**
 * A corridor, which is a pair of places rather than a direction between
 * them.
 *
 * Deliberately derived rather than stored. A corridor has no identity of
 * its own yet - it is exactly "these two places" - so inventing a table
 * would mean a migration, a backfill and a second source of truth for
 * something a sorted pair of ids already expresses. The table can come
 * later, when something genuinely needs to live on a corridor.
 *
 * The two directions stay separate networks on purpose. Fuzhounese New
 * York and Americans in Xiamen share a route and almost nothing else -
 * different languages, different concerns, and a population ratio of
 * about a hundred to one. What they do share is everything on this page:
 * the reference facts, the institutions, and eventually the people
 * travelling between them.
 */
async function loadCorridor(pair: string, locale: Locale) {
  const ids = corridorIdsFromSlug(pair);
  if (!ids) return null;
  const [lowId, highId] = ids;

  const supabase = await createClient();
  const { data: places } = await supabase
    .from("places")
    .select("id, name, hidden_from_search")
    .in("id", [lowId, highId]);

  const low = (places ?? []).find((p) => p.id === lowId);
  const high = (places ?? []).find((p) => p.id === highId);
  // hidden_from_search covers organisation anchors and test geographies.
  if (!low || !high || low.hidden_from_search || high.hidden_from_search) return null;

  // Both directions, if they exist. Either may be absent - most corridors
  // have only ever been created one way round.
  const [{ data: lowToHigh }, { data: highToLow }] = await Promise.all([
    supabase
      .from("networks")
      .select("id, title, member_count")
      .eq("origin_place_id", lowId)
      .eq("location_place_id", highId)
      .maybeSingle(),
    supabase
      .from("networks")
      .select("id, title, member_count")
      .eq("origin_place_id", highId)
      .eq("location_place_id", lowId)
      .maybeSingle(),
  ]);

  // Reference facts are per-destination, so gather whichever ends we have
  // data for and show both.
  const contexts = (
    await Promise.all([
      getCorridorContext(supabase, { origin_place_id: lowId, location_place_id: highId }),
      getCorridorContext(supabase, { origin_place_id: highId, location_place_id: lowId }),
    ])
  ).filter(Boolean) as CorridorContext[];

  return {
    low: { id: lowId, name: low.name as string },
    high: { id: highId, name: high.name as string },
    lowToHigh: (lowToHigh as NetworkRow | null) ?? null,
    highToLow: (highToLow as NetworkRow | null) ?? null,
    contexts,
    locale,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("corridorPage");
  const loaded = await loadCorridor(pair, locale);
  if (!loaded) return {};

  return shareMetadata({
    title: t("title", { a: loaded.low.name, b: loaded.high.name }),
    description: previewText(t("metaDescription", { a: loaded.low.name, b: loaded.high.name })),
    path: `/corridors/${corridorSlug(loaded.low, loaded.high)}`,
  });
}

export default async function CorridorPage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("corridorPage");
  const loaded = await loadCorridor(pair, locale);
  if (!loaded) notFound();

  const { low, high, lowToHigh, highToLow, contexts } = loaded;

  const directions: { from: { id: number; name: string }; to: { id: number; name: string }; network: NetworkRow | null }[] =
    [
      { from: low, to: high, network: lowToHigh },
      { from: high, to: low, network: highToLow },
    ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title", { a: low.name, b: high.name })}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("directionsHeading")}</h2>
        {directions.map((direction) => (
          <div
            key={`${direction.from.id}-${direction.to.id}`}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-surface p-4"
          >
            {direction.network ? (
              <>
                <Link
                  href={`/networks/${slugWithId(direction.network.title, direction.network.id)}`}
                  className="font-medium text-ink underline hover:text-primary"
                >
                  {direction.network.title}
                </Link>
                <span className="text-sm text-muted tabular-nums">
                  {t("membersLabel", { count: direction.network.member_count ?? 0 })}
                </span>
              </>
            ) : (
              <>
                <span className="text-body">
                  {direction.from.name} → {direction.to.name}
                </span>
                <span className="flex items-baseline gap-3 text-sm">
                  <span className="text-muted">{t("noNetwork")}</span>
                  {/* Prefilled, so "start it" lands on Launch rather than
                      on an empty search form. */}
                  <Link
                    href={`/search/results?originId=${direction.from.id}&originQuery=${encodeURIComponent(direction.from.name)}&locationId=${direction.to.id}&locationQuery=${encodeURIComponent(direction.to.name)}`}
                    className="text-primary underline"
                  >
                    {t("startThis")}
                  </Link>
                </span>
              </>
            )}
          </div>
        ))}
      </section>

      {contexts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-ink">{t("factsHeading")}</h2>
          {contexts.map((context) => (
            <CorridorContextBlock
              key={context.cityName}
              context={context}
              cityPlaceId={context.cityName === low.name ? low.id : high.id}
              isEmpty={false}
            />
          ))}
        </section>
      )}
    </div>
  );
}
