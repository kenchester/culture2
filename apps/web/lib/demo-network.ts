import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Whether a network belongs to an example org (Acme, today,
// 00000000000061_organizations_is_example.sql) - its posts/replies get
// dynamically computed "just now" / "this time yesterday" timestamps
// instead of their real, ever-more-distant created_at (demoPostTimestamp
// below), so the demo never reads as stale no matter when someone visits
// it. Every other network just shows its real timestamps as-is.
export async function isExampleNetwork(
  supabase: SupabaseClient,
  locationPlaceId: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("organizations")
    .select("is_example")
    .eq("location_place_id", locationPlaceId)
    .maybeSingle();
  return data?.is_example ?? false;
}

// Half a network's demo posts/replies show as posted "now", half as "this
// time yesterday" - split by id parity, which is stable across renders
// without needing a stored flag. The extra per-item spread (up to ~4h,
// derived from the id itself) keeps a network's feed from showing a wall
// of identical timestamps.
export function demoPostTimestamp(itemId: number): string {
  const dayOffsetMs = itemId % 2 === 0 ? 0 : 24 * 60 * 60 * 1000;
  const spreadMs = ((itemId * 37) % 240) * 60 * 1000;
  return new Date(Date.now() - dayOffsetMs - spreadMs).toISOString();
}

// See events.demo_days_from_now (00000000000070_demo_event_dates.sql) -
// computed fresh on every request rather than a fixed calendar date that
// would otherwise drift into the past the longer the demo has existed.
export function demoEventTimestamp(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}
