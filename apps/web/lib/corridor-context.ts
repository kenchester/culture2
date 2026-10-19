import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerIsInside } from "@/lib/place-containment";
import { greatCircleKm } from "@/lib/distance";

/**
 * The reference layer for one corridor, assembled entirely from data the
 * city pages already loaded.
 *
 * A corridor IS a (destination city, origin country) pair, which is
 * exactly how city_origin_stats is keyed - so a network page can state
 * how many people this corridor actually contains without any new source.
 *
 * The point is that all of this is true and useful when the network has
 * nobody in it, which is the state almost every corridor is in. A page
 * that says only "no posts yet" gives a visitor who arrived from a search
 * engine no reason to stay or return.
 */

type PlaceRow = {
  id: number;
  name: string;
  type: string;
  iso_code: string | null;
  parent_id: number | null;
};

export type CorridorContext = {
  /** Country the origin resolves to, walking up the place hierarchy. */
  countryIso: string;
  countryName: string;
  /** Set when the network's origin is narrower than the country, e.g.
   *  Fujian within China - the case official statistics cannot see. */
  subNationalOrigin: string | null;
  cityName: string;
  /** Foreign-born residents of the city born in that country. */
  people: number | null;
  peopleSource: string | null;
  peoplePeriod: string | null;
  consulate: { missionType: string | null; website: string | null } | null;
  /** False when this city's consular list has never been loaded, which is
   *  not the same claim as "no consulate exists". */
  consulateDataLoaded: boolean;
  /** The actual pair, when one exists - naming it is both more useful and
   *  harder to get quietly wrong than a bare yes. */
  twinning: { cityName: string; partnerName: string } | null;
  /** Null whenever either end lacks coordinates, which countries mostly
   *  do - better no figure than an invented centroid. */
  distanceKm: number | null;
};

/** A place and everything that contains it, up to the country. */
async function ancestorsOf(supabase: SupabaseClient, placeId: number): Promise<number[]> {
  const chain = [placeId];
  let current: number | null = placeId;
  for (let depth = 0; depth < 3 && current; depth++) {
    const { data }: { data: { parent_id: number | null } | null } = await supabase
      .from("places")
      .select("parent_id")
      .eq("id", current)
      .maybeSingle();
    current = data?.parent_id ?? null;
    if (current) chain.push(current);
  }
  return chain;
}

/**
 * Is there a sister-city relationship between these two places?
 *
 * Sister cities are always city-to-city, but a corridor pairs places at
 * any level - Fujian to New York City is a region and a city. Matching on
 * country, which is what this used to do, made New York's partnership
 * with Beijing read as a tie to every Chinese region including Fujian,
 * which it plainly is not.
 *
 * So the test is containment: a pair (X, Y) counts when X sits inside one
 * end of the corridor and Y inside the other. Computed over the unordered
 * pair, which also makes the answer identical in both directions - it is
 * one relationship, and previously the reverse direction said "no" purely
 * because the other end's sister list had never been loaded.
 */
async function resolveTwinning(
  supabase: SupabaseClient,
  aId: number,
  bId: number,
): Promise<{ cityName: string; partnerName: string } | null> {
  const [aChain, bChain] = await Promise.all([ancestorsOf(supabase, aId), ancestorsOf(supabase, bId)]);

  const { data: rows } = await supabase
    .from("city_sister_cities")
    .select("city_place_id, partner_name, partner_place_id, partner_country_iso")
    .in("city_place_id", [...new Set([...aChain, ...bChain])]);
  if (!rows || rows.length === 0) return null;

  const partnerIds = rows.map((r) => r.partner_place_id).filter(Boolean) as number[];
  const partnerChains = new Map<number, number[]>();
  await Promise.all(
    [...new Set(partnerIds)].map(async (id) => {
      partnerChains.set(id, await ancestorsOf(supabase, id));
    }),
  );

  const { data: countries } = await supabase
    .from("places")
    .select("id, iso_code")
    .in("id", [...new Set([...aChain, ...bChain])])
    .eq("type", "country");
  const isoFor = new Map((countries ?? []).map((c) => [c.id as number, c.iso_code as string | null]));

  const cityIds = [...new Set(rows.map((r) => r.city_place_id as number))];
  const { data: cityNames } = await supabase.from("places").select("id, name").in("id", cityIds);
  const nameFor = new Map((cityNames ?? []).map((c) => [c.id as number, c.name as string]));

  for (const row of rows) {
    const cityId = row.city_place_id as number;
    const onA = aChain.includes(cityId);
    if (!onA && !bChain.includes(cityId)) continue;
    // The OTHER end itself, not its ancestors. Testing against the chain
    // was the bug: Fujian's chain contains China, so New York's
    // partnership with Beijing matched a Fujian corridor. The partner has
    // to sit inside the end in question.
    const otherEndId = onA ? bId : aId;

    const partnerId = row.partner_place_id as number | null;
    const matches = partnerId
      ? partnerIsInside(partnerChains.get(partnerId) ?? [], otherEndId)
      : // A name-only partner carries no place, so the most that can be
        // claimed is that the other end is the country it sits in.
        isoFor.get(otherEndId) === row.partner_country_iso;

    if (matches) {
      return {
        cityName: nameFor.get(cityId) ?? "",
        partnerName: row.partner_name as string,
      };
    }
  }
  return null;
}

export async function getCorridorContext(
  supabase: SupabaseClient,
  network: { origin_place_id: number | null; location_place_id: number },
  // A corridor page shows both directions and has to say "not recorded"
  // for the empty one, rather than silently showing a single side and
  // implying the route only runs one way. A network page describes one
  // direction, so there it is better to render nothing at all.
  options: { allowEmpty?: boolean } = {},
): Promise<CorridorContext | null> {
  if (!network.origin_place_id) return null;

  // Resolve the origin to a country. A corridor can start at a city or a
  // region (Fujian, Chennai, Andhra Pradesh); the census only knows
  // countries, so walk up and remember what we walked past.
  const { data: origin } = await supabase
    .from("places")
    .select("id, name, type, iso_code, parent_id")
    .eq("id", network.origin_place_id)
    .maybeSingle();
  if (!origin) return null;

  let countryIso = origin.iso_code as string | null;
  let countryName = origin.name as string;
  let subNationalOrigin: string | null = null;

  if (origin.type !== "country" && origin.parent_id) {
    let parentId: number | null = origin.parent_id as number;
    for (let depth = 0; depth < 2 && parentId && !countryIso; depth++) {
      const { data: parent }: { data: PlaceRow | null } = await supabase
        .from("places")
        .select("id, name, type, iso_code, parent_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parent) break;
      if (parent.type === "country" && parent.iso_code) {
        countryIso = parent.iso_code as string;
        countryName = parent.name as string;
        subNationalOrigin = origin.name as string;
      }
      parentId = (parent.parent_id as number | null) ?? null;
    }
  }
  if (!countryIso) return null;

  const [{ data: city }, { data: originPlace }] = await Promise.all([
    supabase
      .from("places")
      .select("name, lat, lng")
      .eq("id", network.location_place_id)
      .maybeSingle(),
    supabase
      .from("places")
      .select("lat, lng")
      .eq("id", network.origin_place_id)
      .maybeSingle(),
  ]);
  const distanceKm =
    city && originPlace
      ? greatCircleKm(
          { lat: originPlace.lat as number | null, lng: originPlace.lng as number | null },
          { lat: city.lat as number | null, lng: city.lng as number | null },
        )
      : null;

  const [{ data: stat }, { data: consulate }, twinning, { count: consulateRows }] =
    await Promise.all([
      supabase
        .from("city_origin_stats")
        .select("people, origin_label, source, period")
        .eq("city_place_id", network.location_place_id)
        .eq("origin_country_iso", countryIso)
        .eq("is_total", false)
        .maybeSingle(),
      supabase
        .from("city_consulates")
        .select("mission_type, website")
        .eq("city_place_id", network.location_place_id)
        .eq("country_iso", countryIso)
        .maybeSingle(),
      resolveTwinning(supabase, network.origin_place_id, network.location_place_id),
      supabase
        .from("city_consulates")
        .select("id", { count: "exact", head: true })
        .eq("city_place_id", network.location_place_id),
    ]);

  const consulateDataLoaded = (consulateRows ?? 0) > 0;

  // Nothing to say at all - better to render no block than an empty one,
  // unless the caller specifically wants the absence shown.
  if (!stat && !consulate && !consulateDataLoaded && !options.allowEmpty) return null;

  return {
    countryIso,
    countryName: (stat?.origin_label as string | undefined) ?? countryName,
    subNationalOrigin,
    cityName: (city?.name as string | undefined) ?? "",
    people: (stat?.people as number | undefined) ?? null,
    peopleSource: (stat?.source as string | undefined) ?? null,
    peoplePeriod: (stat?.period as string | undefined) ?? null,
    consulate: consulate
      ? {
          missionType: (consulate.mission_type as string | null) ?? null,
          website: (consulate.website as string | null) ?? null,
        }
      : null,
    consulateDataLoaded,
    twinning,
    distanceKm,
  };
}
