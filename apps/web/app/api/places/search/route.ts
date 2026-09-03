import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/locale";
import { isSearchableQuery } from "@/lib/search-query";

const PLACE_TYPES = ["country", "region", "city"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const kindParam = searchParams.get("kind");
  const kind = kindParam === "language" || kindParam === "religion" ? kindParam : "place";
  const typeParam = searchParams.get("type");
  // A caller can ask for multiple types at once (e.g. "country,region" - a
  // school can be a region-level entity within a country, or sit directly
  // under a country the way Washington D.C. does under the US, so its
  // parent picker needs to accept either). search_places itself only
  // filters on a single type, so a multi-type request goes through
  // unfiltered and gets filtered here instead.
  const requestedTypes = (typeParam?.split(",") ?? []).map((t) => t.trim()).filter((t) => PLACE_TYPES.includes(t));
  const type = requestedTypes.length === 1 ? requestedTypes[0] : null;
  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "en";

  if (!isSearchableQuery(q)) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  if (kind === "language") {
    // search_languages matches diacritic-insensitively (e.g. typing
    // "Aland" still needs to work for places, and this keeps languages
    // consistent) - see 00000000000041_unaccent_search.sql - and now
    // also matches/returns the current locale's cached translated name
    // (e.g. "Mandarin" while browsing in Spanish still needs to find
    // "chino mandarín") - see 00000000000042_locale_aware_search.sql.
    const { data, error } = await supabase.rpc("search_languages", {
      p_query: q,
      p_limit: 10,
      p_locale: locale,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // excludeSigned is for fields asking which *written* language a piece
    // of text is in - the signed-language summary composer, today. A
    // signed language has no written form, so "American Sign Language" is
    // never a valid answer there, and picking it would store a summary
    // tagged with a language that has no iso_code: Translate would have no
    // source language and screen readers no lang to switch to. Filtered
    // here rather than in search_languages, which is shared by every
    // language picker in the app and should keep returning all of them.
    if (searchParams.get("excludeSigned") === "1") {
      const { data: signed } = await supabase.from("languages").select("id").eq("is_signed", true);
      const signedIds = new Set((signed ?? []).map((l) => l.id));
      return NextResponse.json(
        ((data ?? []) as { id: number }[]).filter((row) => !signedIds.has(row.id)),
      );
    }

    return NextResponse.json(data);
  }

  if (kind === "religion") {
    // Reuses guess_religions rather than a plain ilike here, so live-typing
    // suggestions are alias-aware too (e.g. typing "Baha" surfaces "Bahá'í"
    // immediately) instead of only on the post-submit guessing fallback.
    const { data, error } = await supabase.rpc("guess_religions", { p_query: q, p_limit: 10 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // search_places matches diacritic-insensitively (e.g. "Sao Tome" finds
  // "São Tomé and Príncipe") - see 00000000000041_unaccent_search.sql -
  // and also matches/returns the current locale's cached translated name
  // (e.g. "Estados Unidos" finds "United States" while browsing in
  // Spanish) - see 00000000000042_locale_aware_search.sql. Reshapes its
  // flat parent_name/parent_type columns into the nested
  // `parent: {name, type}` shape PlaceOption (components/autocomplete-
  // field.tsx) already expects, so the frontend needs no changes there.
  const { data, error } = await supabase.rpc("search_places", {
    p_query: q,
    p_type: type,
    p_limit: 10,
    p_locale: locale,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  type SearchPlaceRow = {
    id: number;
    name: string;
    type: "country" | "region" | "city";
    parent_id: number | null;
    parent_name: string | null;
    parent_type: "country" | "region" | "city" | null;
  };
  const shaped = ((data ?? []) as SearchPlaceRow[])
    .filter((row) => requestedTypes.length <= 1 || requestedTypes.includes(row.type))
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      parent_id: row.parent_id,
      parent: row.parent_name ? { name: row.parent_name, type: row.parent_type } : null,
    }));
  return NextResponse.json(shaped);
}
