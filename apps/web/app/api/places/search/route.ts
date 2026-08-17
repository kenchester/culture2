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
    const { data, error } = await supabase
      .from("languages")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(10);
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

  let query = supabase
    .from("places")
    .select("id, name, type, parent_id, parent:parent_id(name, type)")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);
  if (type) {
    query = query.eq("type", type);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
