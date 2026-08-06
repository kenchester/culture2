import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profiles";
import { cancelRsvp, rsvp } from "@/app/networks/[id]/events/[eventId]/actions";

const STATUSES = ["going", "interested", "declined"] as const;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, eventId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, host:host_id(id, username, first_name, last_name)",
    )
    .eq("id", eventId)
    .single();

  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rsvps }, { data: myRsvp }] = await Promise.all([
    supabase.from("event_rsvps").select("status").eq("event_id", event.id),
    user
      ? supabase
          .from("event_rsvps")
          .select("status")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const counts = { going: 0, interested: 0, declined: 0 };
  for (const r of rsvps ?? []) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
  }

  const host = event.host as unknown as {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <Link href={`/networks/${id}/events`} className="text-sm text-zinc-500 underline">
        Back to events
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-sm text-zinc-600">
          {new Date(event.event_date).toLocaleString()}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {host && (
          <p className="text-sm text-zinc-600">
            Hosted by{" "}
            <Link href={`/profile/${host.id}`} className="underline">
              {getDisplayName(host)}
            </Link>
          </p>
        )}
      </div>

      {event.description && <p>{event.description}</p>}

      <p className="text-sm text-zinc-600">
        {counts.going} going, {counts.interested} interested, {counts.declined} declined
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {user ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {STATUSES.map((status) => (
              <form key={status} action={rsvp}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="networkId" value={id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className={`rounded px-3 py-2 capitalize ${
                    myRsvp?.status === status
                      ? "bg-black text-white"
                      : "border"
                  }`}
                >
                  {status}
                </button>
              </form>
            ))}
          </div>
          {myRsvp && (
            <form action={cancelRsvp}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="networkId" value={id} />
              <button type="submit" className="text-sm text-zinc-500 underline">
                Remove my RSVP
              </button>
            </form>
          )}
        </div>
      ) : (
        <a href="/sign-in" className="text-sm underline">
          Sign in to RSVP
        </a>
      )}
    </div>
  );
}
