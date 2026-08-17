import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public, unauthenticated endpoint for partners building their own
// frontend against CultureMesh data (plan §6). Data itself is already
// public (RLS allows anon select on networks/places/languages), so this
// just wraps search_networks in a stable HTTP contract with CORS enabled
// for cross-origin calls from a partner's own domain.
//
// Known gap: not rate-limited. This project has no rate-limiting
// infrastructure (e.g. Upstash) set up yet - adding real limits here is
// follow-up work, not something to fake with a comment.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originKind = searchParams.get("originKind");
  const originId = searchParams.get("originId");
  const locationId = searchParams.get("locationId");

  if (
    (originKind !== "language" && originKind !== "place") ||
    !originId ||
    !locationId
  ) {
    return NextResponse.json(
      {
        error:
          "originKind ('language' or 'place'), originId, and locationId query params are required",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const isLanguage = originKind === "language";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_networks", {
    p_language_id: isLanguage ? Number(originId) : null,
    p_origin_place_id: isLanguage ? null : Number(originId),
    p_religion_id: null,
    p_location_place_id: Number(locationId),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ results: data }, { headers: CORS_HEADERS });
}
