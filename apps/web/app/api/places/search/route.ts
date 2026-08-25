import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLACE_TYPES = ["country", "region", "city"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const kindParam = searchParams.get("kind");
  const kind = kindParam === "language" || kindParam === "religion" ? kindParam : "place";
  const typeParam = searchParams.get("type");
  const type = typeParam && PLACE_TYPES.includes(typeParam) ? typeParam : null;

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  if (kind === "language") {
    // search_languages matches diacritic-insensitively (e.g. typing
    // "Aland" still needs to work for places, and this keeps languages
    // consistent) - see 00000000000041_unaccent_search.sql.
    const { data, error } = await supabase.rpc("search_languages", { p_query: q, p_limit: 10 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
  // "São Tomé and Príncipe") - see 00000000000041_unaccent_search.sql.
  // Reshapes its flat parent_name/parent_type columns into the nested
  // `parent: {name, type}` shape PlaceOption (components/autocomplete-
  // field.tsx) already expects, so the frontend needs no changes.
  const { data, error } = await supabase.rpc("search_places", {
    p_query: q,
    p_type: type,
    p_limit: 10,
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
  const shaped = ((data ?? []) as SearchPlaceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    parent_id: row.parent_id,
    parent: row.parent_name ? { name: row.parent_name, type: row.parent_type } : null,
  }));
  return NextResponse.json(shaped);
}
