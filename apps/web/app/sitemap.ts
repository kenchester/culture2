import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, isLearnHost } from "@/lib/site-url";
import { corridorSlug, slugWithId } from "@/lib/slug";

/**
 * Everything worth finding from a search engine.
 *
 * Until now nothing was listed at all, which meant the reference pages -
 * city pages, corridor pages, the outpost directory - were reachable only
 * by someone who already had the link. That is the opposite of what they
 * are for: the whole argument for building them is that they answer
 * questions people type into a search box before they have ever heard of
 * CultureMesh.
 *
 * Deliberately excluded: posts and replies, which are members' words
 * rather than reference material and already carry noindex; organisation
 * networks, which are gated; and anything on a sequestered host, matching
 * app/robots.ts.
 */

// Supabase caps a response at 1000 rows (supabase/config.toml), and a
// sitemap is capped at 50,000 URLs by the spec. Neither is close yet, but
// the cap is stated so a future run doesn't silently truncate.
const MAX_ROWS = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // learn.culturemesh.com has its own content and its own gating; it does
  // not want the main site's URL list.
  if (await isLearnHost()) return [];

  const siteUrl = await getSiteUrl();
  const supabase = await createClient();
  const url = (path: string) => `${siteUrl}${path}`;

  const staticPaths = [
    "/",
    "/about",
    "/search",
    "/outposts",
    "/outposts/elections",
    "/training",
    "/schools",
    "/faith",
    "/contact",
    "/privacy",
    "/terms",
  ];

  const [{ data: networks }, { data: cities }, { data: outposts }] = await Promise.all([
    supabase
      .from("networks")
      .select("id, title, origin_place_id, location_place_id, member_count")
      .order("member_count", { ascending: false })
      .limit(MAX_ROWS),
    // Only cities we actually hold reference data for - a bare city page
    // with nothing on it is not worth asking a crawler to fetch.
    supabase.from("city_origin_stats").select("city_place_id").eq("is_total", true),
    supabase.from("outposts").select("id"),
  ]);

  // An organisation's networks are gated (00000000000078) and must not be
  // advertised; they are identified by their location being hidden.
  const placeIds = [
    ...new Set(
      (networks ?? []).flatMap((n) => [n.origin_place_id, n.location_place_id]).filter(Boolean),
    ),
  ] as number[];
  const { data: places } = placeIds.length
    ? await supabase
        .from("places")
        .select("id, name, hidden_from_search")
        .in("id", placeIds)
        .limit(MAX_ROWS)
    : { data: [] };
  const placeById = new Map((places ?? []).map((p) => [p.id as number, p]));
  const visible = (id: number | null) =>
    id !== null && placeById.get(id) && !placeById.get(id)!.hidden_from_search;

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: url(path),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));

  const corridorSeen = new Set<string>();
  for (const network of networks ?? []) {
    if (!visible(network.location_place_id as number)) continue;
    if (network.origin_place_id && !visible(network.origin_place_id as number)) continue;

    entries.push({
      url: url(`/networks/${slugWithId(network.title as string, network.id as number)}`),
      changeFrequency: "daily",
      priority: 0.7,
    });

    // One corridor page per unordered pair, so the two directions do not
    // produce two URLs for the same content.
    if (network.origin_place_id) {
      const origin = placeById.get(network.origin_place_id as number)!;
      const location = placeById.get(network.location_place_id as number)!;
      const slug = corridorSlug(
        { id: origin.id as number, name: origin.name as string },
        { id: location.id as number, name: location.name as string },
      );
      if (!corridorSeen.has(slug)) {
        corridorSeen.add(slug);
        entries.push({ url: url(`/corridors/${slug}`), changeFrequency: "weekly", priority: 0.6 });
      }
    }
  }

  const cityIds = [...new Set((cities ?? []).map((c) => c.city_place_id as number))];
  const { data: cityPlaces } = cityIds.length
    ? await supabase.from("places").select("id, name").in("id", cityIds)
    : { data: [] };
  for (const city of cityPlaces ?? []) {
    entries.push({
      url: url(`/cities/${slugWithId(city.name as string, city.id as number)}`),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const outpost of outposts ?? []) {
    entries.push({ url: url(`/outposts/${outpost.id}`), changeFrequency: "monthly", priority: 0.5 });
  }

  return entries;
}
