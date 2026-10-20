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

/**
 * How large a community has to be before its corridor is listed.
 *
 * A corridor page needs no network to be worth reading - Honduras to
 * Houston carries 71,461 people, a Consulate-General and a distance
 * whether or not anybody has joined. So the list is drawn from the census
 * rather than from the 43 networks that happen to exist.
 *
 * The threshold is the honest part. A page about forty thousand Hondurans
 * in Houston is a real subject; a page about eleven Monegasques is thin
 * content dressed as coverage, and publishing two thousand of those is
 * how a site teaches a search engine to distrust it. 2,500 keeps roughly
 * 600 pages, each about a community large enough to have somewhere to
 * meet.
 */
const MIN_CORRIDOR_POPULATION = 2_500;

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
    "/cities",
    "/corridors",
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

  // Corridors the census implies, which is most of them. Paged, because
  // this is the one query here that exceeds a thousand rows.
  const censusCorridors: { cityId: number; iso: string; people: number }[] = [];
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data: page } = await supabase
      .from("city_origin_stats")
      .select("city_place_id, origin_country_iso, people")
      .eq("is_total", false)
      .gte("people", MIN_CORRIDOR_POPULATION)
      .order("people", { ascending: false })
      .range(offset, offset + MAX_ROWS - 1);
    if (!page || page.length === 0) break;
    for (const row of page) {
      censusCorridors.push({
        cityId: row.city_place_id as number,
        iso: row.origin_country_iso as string,
        people: row.people as number,
      });
    }
    if (page.length < MAX_ROWS) break;
  }

  const censusIsos = [...new Set(censusCorridors.map((c) => c.iso))];
  const { data: originCountries } = censusIsos.length
    ? await supabase
        .from("places")
        .select("id, name, iso_code")
        .eq("type", "country")
        .in("iso_code", censusIsos)
    : { data: [] };
  const countryForIso = new Map(
    (originCountries ?? []).map((c) => [c.iso_code as string, c]),
  );

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

  const cityNameFor = new Map((cityPlaces ?? []).map((c) => [c.id as number, c.name as string]));
  for (const corridor of censusCorridors) {
    const country = countryForIso.get(corridor.iso);
    const cityName = cityNameFor.get(corridor.cityId);
    if (!country || !cityName) continue;
    const slug = corridorSlug(
      { id: country.id as number, name: country.name as string },
      { id: corridor.cityId, name: cityName },
    );
    if (corridorSeen.has(slug)) continue;
    corridorSeen.add(slug);
    entries.push({ url: url(`/corridors/${slug}`), changeFrequency: "monthly", priority: 0.6 });
  }

  for (const outpost of outposts ?? []) {
    entries.push({ url: url(`/outposts/${outpost.id}`), changeFrequency: "monthly", priority: 0.5 });
  }

  return entries;
}
