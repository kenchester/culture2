import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGeoName } from "@/lib/geo-translation";
import type { Locale } from "@/lib/locale";

/**
 * "Xiamen, Fujian, China" for a place id.
 *
 * One level of context isn't enough once names repeat: there is a San Jose
 * in California, in Costa Rica and in the Philippines, and a label reading
 * "San Jose, San Jose" asks the reader to supply what the label was
 * supposed to tell them.
 *
 * At most three deep, because a city's parent may be a region OR a country
 * (00000000000001) - the walk simply stops when there is no parent left.
 * Each level is translated individually, since geo_translations is keyed
 * per place and a region may be translated where its country isn't.
 */
type PlaceRow = {
  id: number;
  name: string;
  type: "country" | "region" | "city";
  iso_code: string | null;
  parent_id: number | null;
};

export async function getPlaceChain(
  supabase: SupabaseClient,
  placeId: number | null | undefined,
  locale: Locale,
  maxDepth = 3,
): Promise<string | null> {
  if (!placeId) return null;

  const names: string[] = [];
  let currentId: number | null = placeId;

  for (let depth = 0; depth < maxDepth && currentId; depth++) {
    const { data }: { data: PlaceRow | null } = await supabase
      .from("places")
      .select("id, name, type, iso_code, parent_id")
      .eq("id", currentId)
      .maybeSingle();
    if (!data) break;
    names.push(
      await getGeoName("place", data.id, data.name, locale, {
        isoCode: data.iso_code,
        placeType: data.type,
      }),
    );
    currentId = data.parent_id;
  }

  return names.length > 0 ? names.join(", ") : null;
}
