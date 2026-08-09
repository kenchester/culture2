import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Used to suggest a realistic placeholder for an admin picking a
// jurisdiction: given a locked origin place, find one real place nested
// inside it - a region if the origin is a whole country, a city if the
// origin is already a region (or has no regions of its own).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: origin } = await supabase
    .from("places")
    .select("id, type")
    .eq("id", id)
    .single();

  if (!origin) {
    return NextResponse.json(null);
  }

  const preferredType = origin.type === "country" ? "region" : "city";

  const { data: preferredChild } = await supabase
    .from("places")
    .select("name, type")
    .eq("parent_id", origin.id)
    .eq("type", preferredType)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (preferredChild) {
    return NextResponse.json(preferredChild);
  }

  if (preferredType === "region") {
    const { data: cityChild } = await supabase
      .from("places")
      .select("name, type")
      .eq("parent_id", origin.id)
      .eq("type", "city")
      .order("name")
      .limit(1)
      .maybeSingle();

    if (cityChild) {
      return NextResponse.json(cityChild);
    }
  }

  return NextResponse.json(null);
}
