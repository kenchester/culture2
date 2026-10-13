import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  twinned: boolean;
  /** The same origin, counted in other cities we hold data for. */
  elsewhere: { cityPlaceId: number; cityName: string; people: number }[];
};

export async function getCorridorContext(
  supabase: SupabaseClient,
  network: { origin_place_id: number | null; location_place_id: number },
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

  const { data: city } = await supabase
    .from("places")
    .select("name")
    .eq("id", network.location_place_id)
    .maybeSingle();

  const [{ data: stat }, { data: consulate }, { data: sister }, { data: elsewhere }] =
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
      supabase
        .from("city_sister_cities")
        .select("partner_name")
        .eq("city_place_id", network.location_place_id)
        .eq("partner_country_iso", countryIso)
        .maybeSingle(),
      supabase
        .from("city_origin_stats")
        .select("city_place_id, people")
        .eq("origin_country_iso", countryIso)
        .eq("is_total", false)
        .neq("city_place_id", network.location_place_id)
        .order("people", { ascending: false })
        .limit(4),
    ]);

  const otherCityIds = (elsewhere ?? []).map((row) => row.city_place_id as number);
  const { data: otherCities } = otherCityIds.length
    ? await supabase.from("places").select("id, name").in("id", otherCityIds)
    : { data: [] };
  const nameFor = new Map((otherCities ?? []).map((p) => [p.id as number, p.name as string]));

  // Nothing to say at all - better to render no block than an empty one.
  if (!stat && !consulate && (elsewhere ?? []).length === 0) return null;

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
    twinned: Boolean(sister),
    elsewhere: (elsewhere ?? [])
      .filter((row) => nameFor.has(row.city_place_id as number))
      .map((row) => ({
        cityPlaceId: row.city_place_id as number,
        cityName: nameFor.get(row.city_place_id as number)!,
        people: row.people as number,
      })),
  };
}
