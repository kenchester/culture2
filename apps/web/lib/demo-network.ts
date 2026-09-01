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
// time yesterday" - split by *position in the list*, not id parity (an
// earlier version split by id % 2, which scattered "today" and "yesterday"
// items at random through the feed instead of reading as an actual
// timeline). index/total describe the item's place in whatever order it's
// already being rendered in; newestFirst says which end of that order is
// most recent - true for the main post feed (query orders by created_at
// desc, newest at the top), false for a reply thread (orders ascending,
// oldest at the top, newest at the bottom). Whichever half is "today" gets
// evenly spaced minutes-ago offsets within it (freshest item in that half
// first) so consecutive items still read as a plausible timeline instead
// of a wall of identical timestamps.
export function demoPostTimestamp(index: number, total: number, newestFirst: boolean): string {
  const half = Math.ceil(total / 2);
  const rankFromNewest = newestFirst ? index : total - 1 - index;
  const isToday = rankFromNewest < half;
  const rankWithinHalf = isToday ? rankFromNewest : rankFromNewest - half;
  const stepMinutes = 12;
  const dayOffsetMs = isToday ? 0 : 24 * 60 * 60 * 1000;
  const spreadMs = rankWithinHalf * stepMinutes * 60 * 1000;
  return new Date(Date.now() - dayOffsetMs - spreadMs).toISOString();
}

// See events.demo_days_from_now (00000000000070_demo_event_dates.sql) -
// computed fresh on every request rather than a fixed calendar date that
// would otherwise drift into the past the longer the demo has existed.
export function demoEventTimestamp(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}
