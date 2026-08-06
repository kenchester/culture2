import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PlaceRow = {
  id: number;
  name: string;
  type: "country" | "region" | "city";
  parent_name: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerSlug: string }> },
) {
  const { partnerSlug } = await params;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_places_for_partner", {
    p_partner_slug: partnerSlug,
    p_query: q,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = ((data ?? []) as PlaceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    parent: row.parent_name ? { name: row.parent_name } : null,
  }));

  return NextResponse.json(results);
}
